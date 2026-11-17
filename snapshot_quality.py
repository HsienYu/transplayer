#!/usr/bin/env python3
"""Fail-closed MHTML challenge inspection. Emits metadata only, never page text."""
import json
import re
import sys
from email import policy
from email.parser import BytesParser
from html.parser import HTMLParser


class VisibleText(HTMLParser):
    def __init__(self, depth=0):
        super().__init__(convert_charrefs=True)
        self.skip = 0
        self.depth = depth
        self.challenge = False
        self.parts = []

    def handle_starttag(self, tag, attrs):
        if tag in ("iframe", "frame"):
            values = dict(attrs)
            if re.search(r"recaptcha|/sorry(?:/|[?#]|$)", values.get("src") or "", re.I):
                self.challenge = True
            if values.get("srcdoc"):
                if self.depth >= 8:
                    self.challenge = True
                else:
                    nested = VisibleText(self.depth + 1)
                    nested.feed(values["srcdoc"])
                    self.parts.extend(nested.parts)
                    self.challenge |= nested.challenge
        if tag in ("script", "style"):
            self.skip += 1

    def handle_endtag(self, tag):
        if tag in ("script", "style"):
            self.skip = max(0, self.skip - 1)

    def handle_data(self, data):
        if not self.skip:
            self.parts.append(data)


def inspect(data):
    if not data or len(data) > 64 * 1024 * 1024:
        return {"clean": False, "reason": "invalid"}
    message = BytesParser(policy=policy.default).parsebytes(data)
    if not message.is_multipart() or message.defects:
        return {"clean": False, "reason": "invalid"}
    count = 0
    for part in message.walk():
        if part.get_content_type() != "text/html":
            continue
        count += 1
        raw = part.get_payload(decode=True)
        if raw is None or part.defects:
            return {"clean": False, "reason": "invalid"}
        parser = VisibleText()
        parser.feed(raw.decode(part.get_content_charset() or "utf-8", errors="strict"))
        text = " ".join(" ".join(parser.parts).lower().split())
        if parser.challenge or re.search(r"unusual traffic|not\s+a\s+robot|不是機器人|異常流量", text):
            return {"clean": False, "reason": "challenge", "htmlParts": count}
    return {"clean": count > 0, "reason": "clean" if count else "invalid", "htmlParts": count}


if __name__ == "__main__":
    try:
        result = inspect(sys.stdin.buffer.read(64 * 1024 * 1024 + 1))
    except Exception:
        result = {"clean": False, "reason": "invalid"}
    print(json.dumps(result))

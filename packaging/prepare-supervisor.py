#!/usr/bin/env python3
"""Developer-only tool; npm ci is a separate, explicitly documented build step."""
import argparse
from pathlib import Path
import sys

sys.path.insert(0, str(Path(__file__).resolve().parent / "installer"))
from tools_prepare import prepare

parser = argparse.ArgumentParser()
parser.add_argument("--node-archive", type=Path, required=True)
parser.add_argument("--npm-root", type=Path, required=True)
parser.add_argument("--output", type=Path, required=True)
args = parser.parse_args()
prepare(args.node_archive, args.npm_root, args.output)
print("SUPERVISOR_INPUTS_PREPARED — binaries not executed")

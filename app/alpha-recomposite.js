// Reconstruct an RGBA (transparent) video frame from an OPAQUE "packed" video that
// carries colour and alpha in two stacked regions, so the clip can be hardware-decoded
// (Chromium 156 refuses the HW decode path for alpha unless the codec is HEVC; an opaque
// packed clip has no alpha channel, so it is eligible). The transparency the artwork needs
// -- browser content showing behind the video -- is rebuilt here from the alpha region.
//
// Layout "vstack": a packed frame of size W x (2*H) holds the colour image in the TOP half
// (rows 0..H) and the alpha as a greyscale image in the BOTTOM half (rows H..2H). This is
// exactly what the ffmpeg filter `alphaextract` + `vstack` produces (colour on top).
//
// This module keeps a pure, WebGL-free core (layout maths + a reference pixel recompositor)
// so it is unit-testable under `node --test`, and a thin WebGL path used in the renderer.
// It does NOT replace the native-alpha path; the renderer selects it only when the owned
// config sets videoLayout === "vstack-alpha".

"use strict";

const LAYOUTS = Object.freeze(["vstack-alpha"]);

// Validate a packed frame size and return the content size + the two sample regions.
// Throws on anything that is not a clean vertical stack, so a mis-encoded clip fails
// visibly instead of rendering half an image as the whole frame.
function packedLayout(width, height, layout = "vstack-alpha") {
  if (!LAYOUTS.includes(layout)) {
    throw new Error("Unsupported packed layout: " + String(layout));
  }
  if (!Number.isInteger(width) || !Number.isInteger(height) ||
      width <= 0 || height <= 0) {
    throw new Error("Packed dimensions must be positive integers");
  }
  if (height % 2 !== 0) {
    throw new Error("vstack-alpha packed height must be even (colour over alpha)");
  }
  const contentHeight = height / 2;
  return {
    layout,
    contentWidth: width,
    contentHeight,
    color: { x: 0, y: 0, width, height: contentHeight },
    alpha: { x: 0, y: contentHeight, width, height: contentHeight },
  };
}

// Reference CPU recompositor, mirroring the fragment shader below. `packed` is a flat
// RGBA Uint8 buffer (row-major, top-left origin) of size width*height*4. Returns a flat
// RGBA Uint8 buffer of the content size, with colour.rgb from the top half and the alpha
// taken from the red channel (luma) of the bottom half. Used by tests and as a fallback.
function recompositePixels(packed, width, height, layout = "vstack-alpha") {
  const region = packedLayout(width, height, layout);
  const { contentWidth: cw, contentHeight: ch } = region;
  if (packed.length !== width * height * 4) {
    throw new Error("packed buffer size does not match width*height*4");
  }
  const out = new Uint8ClampedArray(cw * ch * 4);
  for (let y = 0; y < ch; y++) {
    for (let x = 0; x < cw; x++) {
      const o = (y * cw + x) * 4;
      const colorIdx = ((region.color.y + y) * width + (region.color.x + x)) * 4;
      const alphaIdx = ((region.alpha.y + y) * width + (region.alpha.x + x)) * 4;
      out[o] = packed[colorIdx];
      out[o + 1] = packed[colorIdx + 1];
      out[o + 2] = packed[colorIdx + 2];
      out[o + 3] = packed[alphaIdx]; // alpha = luma of the bottom (alpha) region
    }
  }
  return out;
}

const VERTEX_SHADER = `
attribute vec2 a_pos;
varying vec2 v_uv;
void main() {
  v_uv = vec2((a_pos.x + 1.0) * 0.5, (1.0 - a_pos.y) * 0.5); // top-left origin
  gl_Position = vec4(a_pos, 0.0, 1.0);
}`;

// Sample colour from the top half and alpha from the bottom half of the same texture.
const FRAGMENT_SHADER = `
precision mediump float;
varying vec2 v_uv;
uniform sampler2D u_tex;
void main() {
  vec2 colorUv = vec2(v_uv.x, v_uv.y * 0.5);
  vec2 alphaUv = vec2(v_uv.x, v_uv.y * 0.5 + 0.5);
  vec3 color = texture2D(u_tex, colorUv).rgb;
  float alpha = texture2D(u_tex, alphaUv).r;
  gl_FragColor = vec4(color * alpha, alpha); // premultiplied: transparent regions show through
}`;

// Create a WebGL recompositor that draws frames of `video` (a packed opaque source) into
// `canvas` with reconstructed transparency. Call start() once the video is playing; it drives
// itself with requestVideoFrameCallback when available, else requestAnimationFrame. The caller
// keeps owning the <video> element (play/seek/timeupdate/quality/OSC), so choreography and
// reporting are unchanged -- only the on-screen presentation moves from <video> to <canvas>.
function createRecompositor(options) {
  const { video, canvas, layout = "vstack-alpha" } = options;
  if (!video || !canvas) throw new Error("video and canvas are required");
  if (!LAYOUTS.includes(layout)) throw new Error("Unsupported packed layout: " + layout);

  const gl = canvas.getContext("webgl", { premultipliedAlpha: true, alpha: true });
  if (!gl) throw new Error("WebGL is not available for alpha recomposite");

  function compile(type, src) {
    const s = gl.createShader(type);
    gl.shaderSource(s, src);
    gl.compileShader(s);
    if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) {
      throw new Error("Shader compile failed: " + gl.getShaderInfoLog(s));
    }
    return s;
  }
  const program = gl.createProgram();
  gl.attachShader(program, compile(gl.VERTEX_SHADER, VERTEX_SHADER));
  gl.attachShader(program, compile(gl.FRAGMENT_SHADER, FRAGMENT_SHADER));
  gl.linkProgram(program);
  if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
    throw new Error("Program link failed: " + gl.getProgramInfoLog(program));
  }
  gl.useProgram(program);

  const buffer = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 1, -1, -1, 1, 1, 1]), gl.STATIC_DRAW);
  const aPos = gl.getAttribLocation(program, "a_pos");
  gl.enableVertexAttribArray(aPos);
  gl.vertexAttribPointer(aPos, 2, gl.FLOAT, false, 0, 0);

  const texture = gl.createTexture();
  gl.bindTexture(gl.TEXTURE_2D, texture);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
  gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, false);

  let running = false;
  let handle = null;
  const useVFC = typeof video.requestVideoFrameCallback === "function";

  function resize() {
    const w = video.videoWidth;
    const h = Math.floor(video.videoHeight / 2); // content height for vstack
    if (w && h && (canvas.width !== w || canvas.height !== h)) {
      canvas.width = w;
      canvas.height = h;
    }
  }

  function draw() {
    if (!running) return;
    resize();
    if (video.readyState >= 2 && canvas.width && canvas.height) {
      gl.viewport(0, 0, canvas.width, canvas.height);
      gl.bindTexture(gl.TEXTURE_2D, texture);
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, video);
      gl.clearColor(0, 0, 0, 0);
      gl.clear(gl.COLOR_BUFFER_BIT);
      gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
    }
    handle = useVFC ? video.requestVideoFrameCallback(draw)
                    : requestAnimationFrame(draw);
  }

  return {
    start() { if (!running) { running = true; draw(); } },
    stop() {
      running = false;
      if (handle != null) {
        if (useVFC && typeof video.cancelVideoFrameCallback === "function") {
          video.cancelVideoFrameCallback(handle);
        } else if (!useVFC) {
          cancelAnimationFrame(handle);
        }
        handle = null;
      }
    },
    gl,
  };
}

const api = { packedLayout, recompositePixels, createRecompositor,
              LAYOUTS, VERTEX_SHADER, FRAGMENT_SHADER };
if (typeof module !== "undefined" && module.exports) {
  module.exports = api;
}
if (typeof window !== "undefined") {
  window.AlphaRecomposite = api;
}

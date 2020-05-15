import { Universe } from "wasm-game-of-life";
import { memory } from "wasm-game-of-life/wasm_game_of_life_bg";
import {
  lineFragmentShaderSource,
  lineVertexShaderSource,
  triangleFragmentShaderSource,
  triangleVertexShaderSource,
} from "./glsl";
import FrameRate from "./framerate";

const canvas = document.getElementById("game-of-life-canvas");
const gl = canvas.getContext("webgl2");

if (!gl) {
  alert("Your browser does not support WebGL 2 please try another!");
}

// Resize our canvas
resize(canvas);

// Map the WebGL viewport to the canvas size
gl.viewport(0, 0, gl.canvas.width, gl.canvas.height);

const pixelDensity = window.devicePixelRatio || 1;

const GRID_SIZE = 512;
const CELL_GAP = 1; // px
const CELL_SIZE = (gl.canvas.width - CELL_GAP * GRID_SIZE) / GRID_SIZE; // px
const GRID_COLOUR = "#CCCCCC";
const DEAD_COLOUR = "#FFFFFF";
const ALIVE_COLOUR = "#000000";

// Construct the universe and get its width and height.
const universe = Universe.new(
  GRID_SIZE,
  GRID_SIZE,
  CELL_SIZE * pixelDensity,
  CELL_GAP
);
const width = universe.width();
const height = universe.height();

const speedRange = document.getElementById("speed");
const playPauseButton = document.getElementById("play-pause");
const randomResetButton = document.getElementById("random-reset");

let animationId = null;
const lineProgram = createProgramFromSources(
  gl,
  lineVertexShaderSource,
  lineFragmentShaderSource
);
const triangleProgram = createProgramFromSources(
  gl,
  triangleVertexShaderSource,
  triangleFragmentShaderSource
);

const fps = new FrameRate();

drawGrid();
drawCells();

togglePlayState();

canvas.addEventListener("click", toggleCell);
playPauseButton.addEventListener("click", togglePlayState);
randomResetButton.addEventListener("click", randomReset);

function renderLoop() {
  fps.render();

  for (let i = 0; i < speed.value; i++) {
    universe.tick();
  }

  drawGrid();
  drawCells();

  animationId = requestAnimationFrame(renderLoop);
}

function drawGrid() {
  // Create valid typed position data and copy it into the array buffer
  const lineCoordsPtr = universe.grid_line_coords();
  const lineCoordsCount = universe.grid_line_coords_count();
  const lineCoords = new Float32Array(
    memory.buffer,
    lineCoordsPtr,
    lineCoordsCount
  );

  // Create a buffer for the data to be passed to the input attribute
  const positionBuffer = gl.createBuffer();

  // Bind the array buffer and our position buffer
  gl.bindBuffer(gl.ARRAY_BUFFER, positionBuffer);
  gl.bufferData(gl.ARRAY_BUFFER, lineCoords, gl.STATIC_DRAW);

  // Create a collection of attribute state called a Vertex Array Object
  const VAO = gl.createVertexArray();

  // Make `VAO` the current vertex array so that all of our attribute settings
  // will apply to that set of attribute state
  gl.bindVertexArray(VAO);

  // Retreive the location of the GLSL input attribute
  const positionAttributeLocation = gl.getAttribLocation(
    lineProgram,
    "a_position"
  );

  // "Turn the attribute on"
  gl.enableVertexAttribArray(positionAttributeLocation);

  gl.vertexAttribPointer(
    positionAttributeLocation,
    2, // (size) 2 components per iteration
    gl.FLOAT, // (type) The data is 32bit floats
    false, // (normalize) Don't normalize the data
    0, // (stride) 0 = move forward size * sizeof(type) each iteration to get to the next position
    0 // (offset) Start at the beginning
  );

  // Clear the canvas
  gl.clearColor(0, 0, 0, 0);
  gl.clear(gl.COLOR_BUFFER_BIT);

  // Tell WebGL to use our program (pair of shaders)
  gl.useProgram(lineProgram);

  // Bind the attribute/buffer set that we want to use
  gl.bindVertexArray(VAO);

  gl.drawArrays(
    /* primitiveType */ gl.LINES,
    /* offset */ 0,
    /* count */ lineCoordsCount / 2
  );
}

function drawCells() {
  // Create valid typed position data and copy it into the array buffer
  const cellCoordsPtr = universe.cell_coords();
  const cellCoordsCount = universe.cell_coords_count();
  const cellCoords = new Float32Array(
    memory.buffer,
    cellCoordsPtr,
    cellCoordsCount
  );

  // Create a buffer for the data to be passed to the input attribute
  const positionBuffer = gl.createBuffer();

  // Bind the array buffer and our position buffer
  gl.bindBuffer(gl.ARRAY_BUFFER, positionBuffer);

  gl.bufferData(gl.ARRAY_BUFFER, cellCoords, gl.STATIC_DRAW);

  // Tell WebGL to use our program (pair of shaders)
  gl.useProgram(triangleProgram);

  // Create a collection of attribute state called a Vertex Array Object
  const VAO = gl.createVertexArray();

  // Make `VAO` the current vertex array so that all of our attribute settings
  // will apply to that set of attribute state
  gl.bindVertexArray(VAO);

  // Retreive the location of the GLSL input attribute
  const positionAttributeLocation = gl.getAttribLocation(
    triangleProgram,
    "a_position"
  );

  // "Turn the attribute on"
  gl.enableVertexAttribArray(positionAttributeLocation);

  gl.vertexAttribPointer(
    positionAttributeLocation,
    2, // (size) 2 components per iteration
    gl.FLOAT, // (type) The data is 32bit floats
    false, // (normalize) Don't normalize the data
    0, // (stride) 0 = move forward size * sizeof(type) each iteration to get to the next position
    0 // (offset ) Start at the beginning
  );

  // Bind the attribute/buffer set that we want to use
  gl.bindVertexArray(VAO);

  gl.drawArrays(
    /* primitiveType */ gl.TRIANGLES,
    /* offset */ 0,
    /* count */ cellCoordsCount / 2
  );
}

function toggleCell(event) {
  const cssToRealPixels = window.devicePixelRatio || 1;
  const boundingRect = canvas.getBoundingClientRect();

  const scaleX = canvas.width / boundingRect.width;
  const scaleY = canvas.height / boundingRect.height;

  const canvasLeft = (event.clientX - boundingRect.left) * scaleX;
  const canvasTop = (event.clientY - boundingRect.top) * scaleY;

  const row = Math.min(
    Math.floor(canvasTop / (CELL_SIZE + CELL_GAP)),
    height - 1
  );
  const col = Math.min(
    Math.floor(canvasLeft / (CELL_SIZE + CELL_GAP)),
    width - 1
  );

  if (event.ctrlKey) {
    universe.insert_glider(row, col);
  } else if (event.shiftKey) {
    universe.insert_pulsar(row, col);
  } else {
    universe.toggle_cell(row, col);
  }

  drawGrid();
  drawCells();
}

function togglePlayState(event) {
  if (animationId === null) {
    playPauseButton.textContent = "⏸";
    renderLoop();
  } else {
    playPauseButton.textContent = "▶";
    cancelAnimationFrame(animationId);
    animationId = null;
  }
}

function randomReset(event) {
  universe.random_reset();
}

function createShader(gl, type, source) {
  const shader = gl.createShader(type);
  gl.shaderSource(shader, source);
  gl.compileShader(shader);
  const success = gl.getShaderParameter(shader, gl.COMPILE_STATUS);

  if (success) {
    return shader;
  }

  console.log(gl.getShaderInfoLog(shader));
  gl.deleteShader(shader);
}

function createProgram(gl, vertexShader, fragmentShader) {
  const program = gl.createProgram();
  gl.attachShader(program, vertexShader);
  gl.attachShader(program, fragmentShader);
  gl.linkProgram(program);
  const success = gl.getProgramParameter(program, gl.LINK_STATUS);

  if (success) {
    return program;
  }

  console.log(gl.getProgramInfoLog(program));
  gl.deleteProgram(program);
}

function resize(canvas) {
  const cssToRealPixels = window.devicePixelRatio || 1;

  // Lookup the size the browser is displaying the canvas in CSS pixels
  // and compute a size needed to make our drawingbuffer match it in
  // device pixels.
  const displayWidth = Math.floor(canvas.clientWidth * cssToRealPixels);
  const displayHeight = Math.floor(canvas.clientHeight * cssToRealPixels);
  // Check if the canvas is not the same size.
  if (canvas.width !== displayWidth || canvas.height !== displayHeight) {
    // Make the canvas the same size
    canvas.width = displayWidth;
    canvas.height = displayHeight;
  }
}

function createProgramFromSources(
  gl,
  vertexShaderSource,
  fragmentShaderSource
) {
  // Create the fragmentShader
  const fragmentShader = createShader(
    gl,
    gl.FRAGMENT_SHADER,
    fragmentShaderSource
  );

  // Create the vertexShader
  const vertexShader = createShader(gl, gl.VERTEX_SHADER, vertexShaderSource);

  // Link the shaders and createProgram
  return createProgram(gl, vertexShader, fragmentShader);
}

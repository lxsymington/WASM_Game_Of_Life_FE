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
const speedRange = document.getElementById("speed");
const sizeRange = document.getElementById("size");
const playPauseButton = document.getElementById("play-pause");
const randomResetButton = document.getElementById("random-reset");
const infoButton = document.getElementById("info");
const infoCloseButton = document.getElementById("info-close");
const infoModal = document.getElementById("info-modal");

const gl = canvas.getContext("webgl2");

if (!gl) {
  alert("Your browser does not support WebGL 2 please try another!");
}

let initialDimensions = graphDimensions();

// Resize our canvas
resize(canvas);

// Map the WebGL viewport to the canvas size
gl.viewport(0, 0, gl.canvas.width, gl.canvas.height);

// Construct the universe and get its width and height.
const universe = Universe.new(
  initialDimensions.width,
  initialDimensions.height,
  initialDimensions.cellSize,
  initialDimensions.gap
);

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

document.addEventListener("visibilitychange", manageHidden);
canvas.addEventListener("click", toggleCell);
playPauseButton.addEventListener("click", togglePlayState);
randomResetButton.addEventListener("click", randomReset);
window.addEventListener("resize", resizeUniverse);
sizeRange.addEventListener("input", resizeUniverse);
infoButton.addEventListener("click", toggleModal);
infoCloseButton.addEventListener("click", toggleModal);

function renderLoop() {
  const [framerate, sampleSize] = fps.render();

  if (
    (framerate < 6 && sampleSize >= 10) ||
    (framerate < 12 && sampleSize >= 20) ||
    (framerate < 24 && sampleSize >= 100)
  ) {
    return managePerformance(framerate, sampleSize);
  }

  universe.tick(speedRange.value);

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

  // console.log(cellCoords);

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
  const { cellSize, gap, height, pixelDensity, width } = graphDimensions();
  const boundingRect = canvas.getBoundingClientRect();

  const scaleX = canvas.width / boundingRect.width;
  const scaleY = canvas.height / boundingRect.height;

  const canvasLeft = (event.clientX - boundingRect.left) * scaleX;
  const canvasTop = (event.clientY - boundingRect.top) * scaleY;

  const row = Math.min(
    Math.floor(canvasTop / ((cellSize + gap) * pixelDensity)),
    height - 1
  );
  const col = Math.min(
    Math.floor(canvasLeft / ((cellSize + gap) * pixelDensity)),
    width - 1
  );

  console.log(
    { cellSize, gap, pixelDensity, height, width },
    `Row: ${row}, Column: ${col}`,
    universe.width(),
    universe.height()
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
  let dimensions = graphDimensions();
  // Lookup the size the browser is displaying the canvas in CSS pixels
  // and compute a size needed to make our drawingbuffer match it in
  // device pixels.
  const displayWidth = Math.floor(canvas.clientWidth * dimensions.pixelDensity);
  const displayHeight = Math.floor(
    canvas.clientHeight * dimensions.pixelDensity
  );
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

function graphDimensions() {
  const pixelDensity = window.devicePixelRatio || 1;
  const gap = 1;
  const windowWidth = window.innerWidth;
  const windowHeight = window.innerHeight;
  let scale = 1 / pixelDensity;

  while (
    (Math.max(windowWidth, windowHeight) - gap) / (scale * pixelDensity + gap) >
    sizeRange.value
  ) {
    scale++;
  }

  const cellSize = scale * pixelDensity;
  const height = Math.floor(windowHeight / (scale * pixelDensity + gap));
  const width = Math.floor(windowWidth / (scale * pixelDensity + gap));

  return {
    cellSize,
    gap,
    height,
    pixelDensity: window.devicePixelRatio || 1,
    width,
  };
}

function resizeUniverse(event) {
  togglePlayState();
  let { cellSize, gap, height, width } = graphDimensions();
  universe.resize(width, height, cellSize, gap);
  resize(canvas);
  gl.viewport(0, 0, gl.canvas.width, gl.canvas.height);
  drawGrid();
  drawCells();
  togglePlayState();
}

function toggleModal(event) {
  infoModal.classList.toggle("modal--dismissed");
}

function managePerformance(framerate, sampleSize) {
  if (parseInt(speedRange.value, 10) > parseInt(speedRange.min, 10)) {
    fps.reset();
    speedRange.stepDown();
    resizeUniverse();
    alert(
      "The page's performance appears to have been poor on your hardware. Therefore the game has been paused and the cycles per frame has been stepped down."
    );
    return;
  }

  if (parseInt(sizeRange.value, 10) > parseInt(sizeRange.min, 10)) {
    const { cellSize: currentCellSize } = graphDimensions();
    fps.reset();
    do {
      sizeRange.stepDown();
    } while (graphDimensions().cellSize === currentCellSize);
    resizeUniverse();
    alert(
      "The page's performance appears to have been poor on your hardware. Therefore the game has been paused and the max cell count has been stepped down."
    );
    return;
  }

  return;
}

function manageHidden(event) {
  if (document.hidden) {
    playPauseButton.textContent = "▶";
    cancelAnimationFrame(animationId);
    animationId = null;
  } else {
    playPauseButton.textContent = "⏸";
    renderLoop();
  }
}

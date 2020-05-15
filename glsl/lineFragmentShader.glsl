#version 300 es

// Fragment shaders don't have a default precision so we need
// to pick one. highp is a good default. It means "high precision".
precision highp float;

// We need to declare an output for the fragment shader.
out vec4 outColour;

void main() {
    // Just set the output to a constant reddish-purple.
    outColour = vec4(0.8, 0.8, 0.8, 1);
} 

class FrameRate {
  constructor() {
    this.latest = document.getElementById("latest");
    this.mean = document.getElementById("mean");
    this.min = document.getElementById("min");
    this.max = document.getElementById("max");
    this.frames = [];
    this.lastFrameTimeStamp = performance.now();
  }

  render() {
    // Convert the delta time since the last frame render into a measure of
    // frames per second.
    const now = performance.now();
    const delta = now - this.lastFrameTimeStamp;
    this.lastFrameTimeStamp = now;
    const fps = (1 / delta) * 1000;

    // Save only the latest 100 timings.
    this.frames.push(fps);
    if (this.frames.length > 100) {
      this.frames.shift();
    }

    // Find the max, min and mean of our 100 latest timings.
    let min = Infinity;
    let max = -Infinity;
    let sum = 0;
    for (const frame of this.frames) {
      sum += frame;
      min = Math.min(frame, min);
      max = Math.max(frame, max);
    }

    let mean = sum / this.frames.length;

    // Render the statistics.
    this.latest.textContent = Math.round(fps);
    this.mean.textContent = Math.round(mean);
    this.min.textContent = Math.round(min);
    this.max.textContent = Math.round(max);

    return [mean, this.frames.length];
  }

  reset() {
    this.frames = [];
  }
}

export default FrameRate;

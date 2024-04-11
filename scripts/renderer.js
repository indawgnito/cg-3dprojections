import * as CG from "./transforms.js";
import { Matrix, Vector } from "./matrix.js";

const LEFT = 32; // binary 100000
const RIGHT = 16; // binary 010000
const BOTTOM = 8; // binary 001000
const TOP = 4; // binary 000100
const FAR = 2; // binary 000010
const NEAR = 1; // binary 000001
const FLOAT_EPSILON = 0.000001;

class Renderer {
  // canvas:              object ({id: __, width: __, height: __})
  // scene:               object (...see description on Canvas)
  constructor(canvas, scene) {
    this.canvas = document.getElementById(canvas.id);
    this.canvas.width = canvas.width;
    this.canvas.height = canvas.height;
    this.ctx = this.canvas.getContext("2d");
    this.scene = this.processScene(scene);
    this.enable_animation = false; // <-- disabled for easier debugging; enable for animation
    this.start_time = null;
    this.prev_time = null;
  }

  //
  updateTransforms(time, delta_time) {
    // TODO: update any transformations needed for animation
  }

  //
  rotateLeft() {}

  //
  rotateRight() {}

  // translate PRP and SRP across u-axis
  moveLeft() {
    // create references to scene vectors
    let prp = this.scene.view.prp;
    let srp = this.scene.view.srp;

    // reference to u component of vup vector
    let u = this.scene.view.vup.x;
  }

  // translate PRP and SRP across u-axis
  moveRight() {}

  // translate prp and srp across n-axis
  moveBackward() {}

  // translate prp and srp across n-axis
  moveForward() {}

  //
  draw() {
    this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);

    for (let i = 0; i < this.scene.models.length; i++) {
      let model = this.scene.models[i];

      switch (model.type) {
        case "generic":
          // handle generic model case

          // MAIN PERSPECTIVE PROJECTION
          let transformedVertices = [];

          // for each vertex...
          for (const vertex of model.vertices) {
            // create 4 component vector from 3-component array [x,y,z]
            const vertexToTransform = CG.Vector4(
              vertex.x,
              vertex.y,
              vertex.z,
              vertex.w
            );

            // transform vertex to canonical view volume
            const transformedVertex = Matrix.multiply([
              CG.mat4x4Perspective(
                this.scene.view.prp,
                this.scene.view.srp,
                this.scene.view.vup,
                this.scene.view.clip
              ),
              vertexToTransform,
            ]);

            // push to list of vertices which have been transformed
            transformedVertices.push(transformedVertex);
          }

          // CLIPPING
          let clippedLines = [];

          for (let i = 0; i < model.edges.length; i++) {
            // note that edge is an array of two or more indices
            let edge = model.edges[i];

            for (let j = 0; j < edge.length - 1; j++) {
              // create line object with two endpoints
              const line = {
                pt0: transformedVertices[edge[j]],
                pt1: transformedVertices[edge[j + 1]],
              };

              // clip line
              const clippedLine = this.clipLinePerspective(
                line,
                this.scene.view.clip[4]
              );

              if (clippedLine !== null) {
                // update edges with clipped line
                clippedLines.push(clippedLine);
              }
            }
          }

          // 3. Mper
          for (let i = 0; i < clippedLines.length; i++) {
            clippedLines[i] = {
              pt0: Matrix.multiply([CG.mat4x4MPer(), clippedLines[i].pt0]),
              pt1: Matrix.multiply([CG.mat4x4MPer(), clippedLines[i].pt1]),
            };
          }

          // 4. Viewport
          for (let i = 0; i < clippedLines.length; i++) {
            clippedLines[i] = {
              pt0: Matrix.multiply([
                CG.mat4x4Viewport(this.canvas.width, this.canvas.height),
                clippedLines[i].pt0,
              ]),
              pt1: Matrix.multiply([
                CG.mat4x4Viewport(this.canvas.width, this.canvas.height),
                clippedLines[i].pt1,
              ]),
            };
          }

          // draw edges
          for (let i = 0; i < clippedLines.length; i++) {
            const pt0 = clippedLines[i].pt0;
            const pt1 = clippedLines[i].pt1;

            console.log(
              "Drawing line from: (",
              pt0.x,
              ",",
              pt0.y,
              ") to (",
              pt1.x,
              ",",
              pt1.y,
              ")"
            );

            this.drawLine(
              Math.floor(pt0.x / pt0.w),
              Math.floor(pt0.y / pt0.w),
              Math.floor(pt1.x / pt1.w),
              Math.floor(pt1.y / pt1.w)
            );
          }

          break;
        case "cube":
          // handle cube

          break;
        case "cone":
          // handle cone
          break;
        case "cylinder":
          // handle cylinder
          break;
        case "sphere":
          // handle sphere

          // for each stack (separated by horizontal lines)...
          for (let j = 0; j < model.stacks; j++) {
            // for each slice (separated by vertical lines)...
            for (let k = 0; k < model.slices; k++) {
              //
            }
          }

          break;
        default:
          console.log("No model type matched.");
      }
    }

    // TODO: implement drawing here!
    // For each model
    //   * For each vertex
    //     * transform endpoints to canonical view volume
    //   * For each line segment in each edge
    //     * clip in 3D
    //     * project to 2D
    //     * translate/scale to viewport (i.e. window)
    //     * draw line
  }

  // Get outcode for a vertex
  // vertex:       Vector4 (transformed vertex in homogeneous coordinates)
  // z_min:        float (near clipping plane in canonical view volume)
  outcodePerspective(vertex, z_min) {
    let outcode = 0;
    if (vertex.x < vertex.z - FLOAT_EPSILON) {
      outcode += LEFT;
    } else if (vertex.x > -vertex.z + FLOAT_EPSILON) {
      outcode += RIGHT;
    }
    if (vertex.y < vertex.z - FLOAT_EPSILON) {
      outcode += BOTTOM;
    } else if (vertex.y > -vertex.z + FLOAT_EPSILON) {
      outcode += TOP;
    }
    if (vertex.z < -1.0 - FLOAT_EPSILON) {
      outcode += FAR;
    } else if (vertex.z > z_min + FLOAT_EPSILON) {
      outcode += NEAR;
    }
    return outcode;
  }

  // Clip line - should either return a new line (with two endpoints inside view volume)
  //             or null (if line is completely outside view volume)
  // line:         object {pt0: Vector4, pt1: Vector4}
  // z_min:        float (near clipping plane in canonical view volume)
  clipLinePerspective(line, z_min) {
    let result = null;
    let p0 = CG.Vector3(line.pt0.x, line.pt0.y, line.pt0.z);
    let p1 = CG.Vector3(line.pt1.x, line.pt1.y, line.pt1.z);

    let out0 = this.outcodePerspective(p0, z_min);
    let out1 = this.outcodePerspective(p1, z_min);

    // trivially accept if both endpoints are within view rectangle
    // bitwise or the outcode - result equals 0
    if ((out0 | out1) === 0) {
      result = {
        pt0: CG.Vector4(p0.x, p0.y, p0.z, line.pt0.w),
        pt1: CG.Vector4(p1.x, p1.y, p1.z, line.pt1.w),
      };
      return result;
    }

    // trivially reject if both endpoints lie outside the same edge
    // bitwise AND the outcode - result not 0
    else if ((out0 & out1) !== 0) {
      return null;
    }
    // otherwise do some calculations...
    else {
      // we must select an endpoint which is outside the view rect...
      let bitString;

      let selectedEndpoint;

      let t;
      let x;
      let y;
      let z;
      let deltaX;
      let deltaY;
      let deltaZ;

      if (out0 > 0) {
        // pt 0 has outcode > 0

        // populate bit string with base 2 number
        bitString = out0.toString(2);

        // pad to 6 bits
        while (bitString.length < 6) {
          bitString = "0" + bitString;
        }

        selectedEndpoint = 0;

        x = p0.x;
        y = p0.y;
        z = p0.z;

        deltaX = p1.x - p0.x;
        deltaY = p1.y - p0.y;
        deltaZ = p1.z - p0.z;
      } else {
        // must be point 1 whose outcode is > 0
        // indicating that it is outside bounds
        // of at least one edge

        // populate bit string with base 2 number
        bitString = out1.toString(2);

        // pad to 6 bits
        while (bitString.length < 6) {
          bitString = "0" + bitString;
        }

        selectedEndpoint = 1;

        x = p1.x;
        y = p1.y;
        z = p1.z;

        deltaX = p0.x - p1.x;
        deltaY = p0.y - p1.y;
        deltaZ = p0.z - p1.z;
      }
      // find 1st bit set to 1 in selected endpoint's outcode
      let firstBitIndex = -1;

      // iterate through character indices in bit string from R to L
      for (let i = bitString.length - 1; i >= 0; i--) {
        if (bitString.charAt(i) === "1") firstBitIndex = i;
      }

      //  - calculate intersection point between line and corresponding edge
      // note: parametric equations
      // x = x0 + t * (x1 - x0)
      // y = y0 + t * (y1 - y0)
      // z = z0 + t * (z1 - z0)
      // and x0, y0, and z0 are the coordinates of point 1
      // while x1, y1, and z1 are the coordinates of point 2

      if (firstBitIndex === 0) {
        // left of left plane, left: x = z

        t = (-x + z) / (deltaX - deltaZ);

        // We know the x value is z
        x = z;

        // calculate y value
        y = y + t * deltaY;

        // calculate z value
        z = z + t * deltaZ;
      } else if (firstBitIndex === 1) {
        // right of right plane, right: x = -z

        t = (x + z) / (-deltaX - deltaZ);

        // we know the x value is -z
        x = -z;

        // calculate y value
        y = y + t * deltaY;

        // calculate z value
        z = z + t * deltaZ;

        console.log("CLIP X = -Z");
      } else if (firstBitIndex === 2) {
        // below the bottom plane, bottom:: y = z

        t = (-y + z) / (deltaY - deltaZ);

        // calculate x value
        x = x + t * deltaX;

        // we know y = z
        y = z;

        // calculate z value
        z = z + t * deltaZ;

        console.log("CLIP Y = Z");
      } else if (firstBitIndex === 3) {
        // above the top plane, top: y = -z

        t = (y + z) / (-deltaY - deltaZ);

        // calculate x value
        x = x + t * deltaX;

        // we know y = -z
        y = -z;

        // calculate z value
        z = z + t * deltaZ;

        console.log("CLIP Y = -Z");
      } else if (firstBitIndex === 4) {
        // in back of the far plane, far: z = -1

        t = (-z - 1) / deltaZ;

        // calculate x value
        x = x + t * deltaX;

        // calculate y value
        y = y + t * deltaY;

        // we know z = -1
        z = -1;

        console.log("CLIP Z = -1");
      } else if (firstBitIndex === 5) {
        // in front of the near plane, near: z = z_min

        t = (z - z_min) / -deltaZ;

        // calculate x value
        x = x + t * deltaX;

        // calculate y value
        y = y + t * deltaY;

        // we know z = z_min
        z = z_min;

        console.log("CLIP Z = Z_MIN");
      }

      if (selectedEndpoint === 0) {
        // update endpoint 0's coordinates
        p0.x = x;
        p0.y = y;
        p0.z = z;
      } else {
        // update endpoint 1's coordinates
        p1.x = x;
        p1.y = y;
        p1.z = z;
      }
      // clip line again until trivially accepted or rejected
      // I'm just using recursion to handle this
      return this.clipLinePerspective({
        pt0: CG.Vector4(p0.x, p0.y, p0.z, line.pt0.w),
        pt1: CG.Vector4(p1.x, p1.y, p1.z, line.pt1.w),
      });
    }
  }

  //
  animate(timestamp) {
    // Get time and delta time for animation
    if (this.start_time === null) {
      this.start_time = timestamp;
      this.prev_time = timestamp;
    }
    let time = timestamp - this.start_time;
    let delta_time = timestamp - this.prev_time;

    // Update transforms for animation
    this.updateTransforms(time, delta_time);

    // Draw slide
    this.draw();

    // Invoke call for next frame in animation
    if (this.enable_animation) {
      window.requestAnimationFrame((ts) => {
        this.animate(ts);
      });
    }

    // Update previous time to current one for next calculation of delta time
    this.prev_time = timestamp;
  }

  //
  updateScene(scene) {
    this.scene = this.processScene(scene);
    if (!this.enable_animation) {
      this.draw();
    }
  }

  //
  processScene(scene) {
    let processed = {
      view: {
        prp: CG.Vector3(
          scene.view.prp[0],
          scene.view.prp[1],
          scene.view.prp[2]
        ),
        srp: CG.Vector3(
          scene.view.srp[0],
          scene.view.srp[1],
          scene.view.srp[2]
        ),
        vup: CG.Vector3(
          scene.view.vup[0],
          scene.view.vup[1],
          scene.view.vup[2]
        ),
        clip: [...scene.view.clip],
      },
      models: [],
    };

    for (let i = 0; i < scene.models.length; i++) {
      let model = { type: scene.models[i].type };
      if (model.type === "generic") {
        model.vertices = [];
        model.edges = JSON.parse(JSON.stringify(scene.models[i].edges));
        for (let j = 0; j < scene.models[i].vertices.length; j++) {
          model.vertices.push(
            CG.Vector4(
              scene.models[i].vertices[j][0],
              scene.models[i].vertices[j][1],
              scene.models[i].vertices[j][2],
              1
            )
          );
          if (scene.models[i].hasOwnProperty("animation")) {
            model.animation = JSON.parse(
              JSON.stringify(scene.models[i].animation)
            );
          }
        }
      } else {
        model.center = CG.Vector4(
          scene.models[i].center[0],
          scene.models[i].center[1],
          scene.models[i].center[2],
          1
        );
        for (let key in scene.models[i]) {
          if (
            scene.models[i].hasOwnProperty(key) &&
            key !== "type" &&
            key != "center"
          ) {
            model[key] = JSON.parse(JSON.stringify(scene.models[i][key]));
          }
        }
      }

      model.matrix = new Matrix(4, 4);
      processed.models.push(model);
    }

    return processed;
  }

  // x0:           float (x coordinate of p0)
  // y0:           float (y coordinate of p0)
  // x1:           float (x coordinate of p1)
  // y1:           float (y coordinate of p1)
  drawLine(x0, y0, x1, y1) {
    this.ctx.strokeStyle = "#000000";
    this.ctx.beginPath();
    this.ctx.moveTo(x0, y0);
    this.ctx.lineTo(x1, y1);
    this.ctx.stroke();

    this.ctx.fillStyle = "#FF0000";
    this.ctx.fillRect(x0 - 2, y0 - 2, 4, 4);
    this.ctx.fillRect(x1 - 2, y1 - 2, 4, 4);
  }
}

export { Renderer };

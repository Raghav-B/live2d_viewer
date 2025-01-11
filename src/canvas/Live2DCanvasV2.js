
class Live2DCanvasV2 {
    constructor() {
        if (Live2DCanvasV2.instance) {
            return Live2DCanvasV2.instance
        }
        Live2DCanvasV2.instance = this;

        this.viewMatrix = null; /*new L2DViewMatrix();*/
        this.projMatrix = null; /*new L2DMatrix44()*/
        this.deviceToScreen = null; /*new L2DMatrix44();*/

        this.oldLen = 0; // Distance between two points when two-finger tap
        this.frameCount = 0;
        
        // Dragging with middle mouse button
        this.lastMouseX = 0;
        this.lastMouseY = 0;
        this.deltaX = 0;
        this.deltaY = 0;
        this.panning = false;

        this.isPlay = true;
        this.isLookRandom = false;
        this.isModelShown = false;

        this.canvasParent = document.getElementById("canvasParent");
        this.canvas = document.getElementById("glcanvas");        
        this.canvas.width = this.canvasParent.clientWidth;
        this.canvas.height = this.canvasParent.clientHeight;
        this.init();
    }


    init() {
        if (this.canvas.addEventListener) {
            this.canvas.addEventListener("mousewheel", this.mouseEvent, false);
            this.canvas.addEventListener("click", this.mouseEvent, false);
    
            this.canvas.addEventListener("mousedown", this.mouseEvent, false);
            this.canvas.addEventListener("mousemove", this.mouseEvent, false);
    
            this.canvas.addEventListener("mouseup", this.mouseEvent, false);
            this.canvas.addEventListener("mouseout", this.mouseEvent, false);
            this.canvas.addEventListener("contextmenu", this.mouseEvent, false);
    
            // Support touch events
            this.canvas.addEventListener("touchstart", this.touchEvent, false);
            this.canvas.addEventListener("touchend", this.touchEvent, false);
            this.canvas.addEventListener("touchmove", this.touchEvent, false);
        }

        // Initialize 3D buffer
        this.width = this.canvas.width;
        this.height = this.canvas.height;
    
        this.dragMgr = new L2DTargetPoint();
    
        this.resetView();
    
        // Get WebGL context
        this.gl = this.getWebGLContext();
        if (!this.gl) {
            l2dError("Failed to create WebGL context.");
            return;
        }
        // Set the OpenGL context
        Live2D.setGL(this.gl);
    
        // Clear the drawing area with white
        this.gl.clearColor(0.0, 0.0, 0.0, 0.0);
        
        if (LAppLive2DManager.instance.getCount() < 1) {
            return;
        }

        // Call changeModel once to initialize
        this.changeModel(0);
        this.startDraw();
    }


    /*
    * Get the WebGL context
    */
    getWebGLContext() {
        var NAMES = ["webgl", "experimental-webgl", "webkit-3d", "moz-webgl"];

        for (var i = 0; i < NAMES.length; i++) {
            try {
                var ctx = this.canvas.getContext(NAMES[i], {
                    premultipliedAlpha: true,
                    preserveDrawingBuffer: true,
                });
                if (ctx) return ctx;
            } catch (e) {}
        }
        return null;
    }


    startDraw() {
        if (!this.isDrawStart) {
            this.isDrawStart = true;
            (function tick() {
                if (Live2DCanvasV2.instance.isPlay) {
                    Live2DCanvasV2.instance.draw(); // 1回分描画
                }
    
                var requestAnimationFrame =
                    window.requestAnimationFrame ||
                    window.mozRequestAnimationFrame ||
                    window.webkitRequestAnimationFrame ||
                    window.msRequestAnimationFrame;
    
                // Call itself after a certain period of time
                requestAnimationFrame(tick, Live2DCanvasV2.instance.canvas);
            })();
        }
    }


    draw() {    
        MatrixStack.reset();
        MatrixStack.loadIdentity();
    
        if (this.frameCount % 30 == 0) {
            this.lookRandom();
        }
    
        this.dragMgr.update(); // Update parameters for dragging

        // Note: face direction, top-left (-1,1), top-right (1,1), bottom-left (-1,-1), bottom-right (1,-1)
        // this.dragMgr.setPoint(1, 1); // その方向を向く
    
        LAppLive2DManager.instance.setDrag(this.dragMgr.getX(), this.dragMgr.getY());
    
        // Canvasをクリアする
        this.gl.clear(this.gl.COLOR_BUFFER_BIT);
    
        MatrixStack.multMatrix(this.projMatrix.getArray());
        MatrixStack.multMatrix(this.viewMatrix.getArray());
        MatrixStack.push();
    
        for (var i = 0; i < LAppLive2DManager.instance.numModels(); i++) {
            var model = LAppLive2DManager.instance.getModel(i);
    
            if (model == null) return;
    
            if (model.initialized && !model.updating) {
                model.update(this.frameCount);
                model.draw(this.gl);
    
                if (!this.isModelShown && i == LAppLive2DManager.instance.numModels() - 1) {
                    this.isModelShown = !this.isModelShown;
                    var btnPrev = document.getElementById("btnPrev");
                    btnPrev.removeAttribute("disabled");
                    btnPrev.setAttribute("class", "active");
    
                    var btnNext = document.getElementById("btnNext");
                    btnNext.removeAttribute("disabled");
                    btnNext.setAttribute("class", "active");
                }
            }
        }
    
        MatrixStack.pop();
    
        if (this.isPlay) {
            this.frameCount++;
        }
    }


    resetView() {
        // View matrix
        var ratio = this.canvas.height / this.canvas.width;
        var left = LAppDefine.VIEW_LOGICAL_LEFT;
        var right = LAppDefine.VIEW_LOGICAL_RIGHT;
        var bottom = -ratio;
        var top = ratio;
    
        this.viewMatrix = new L2DViewMatrix();
    
        // The range of the screen corresponding to the device. Left end of X, right end of X, bottom end of Y, top end of Y
        this.viewMatrix.setScreenRect(left, right, bottom, top);
    
        // The range of the screen corresponding to the device. Left end of X, right end of X, bottom end of Y, top end of Y
        this.viewMatrix.setMaxScreenRect(
            LAppDefine.VIEW_LOGICAL_MAX_LEFT,
            LAppDefine.VIEW_LOGICAL_MAX_RIGHT,
            LAppDefine.VIEW_LOGICAL_MAX_BOTTOM,
            LAppDefine.VIEW_LOGICAL_MAX_TOP
        );
    
        this.viewMatrix.setMaxScale(LAppDefine.VIEW_MAX_SCALE);
        this.viewMatrix.setMinScale(LAppDefine.VIEW_MIN_SCALE);

        this.viewMatrix.adjustScale(0, 0, LAppDefine.VIEW_MIN_SCALE);
    
        this.projMatrix = new L2DMatrix44();
        this.projMatrix.multScale(1, this.canvas.width / this.canvas.height);
    
        // Screen transformation matrix for mouse
        this.deviceToScreen = new L2DMatrix44();
        this.deviceToScreen.multTranslate(-this.canvas.width / 2.0, -this.canvas.height / 2.0);
        this.deviceToScreen.multScale(2 / this.canvas.width, -2 / this.canvas.width);
    }


    resize() {    
        let live2DModel = LAppLive2DManager.instance.getModel(0).live2DModel;
        if (live2DModel == null) return;
    
        this.resetView();
    
        this.gl.viewport(0, 0, this.canvas.width, this.canvas.height);
    };


    togglePlayPause() {
        this.isPlay = !this.isPlay;
    };


    toggleLookRandom() {
        this.isLookRandom = !this.isLookRandom;
    }


    changeModel(inc=1) {
        this.isModelShown = false;
    
        LAppLive2DManager.instance.reloadFlg = true;
    
        LAppLive2DManager.instance.count += inc;
    
        let txtInfo = document.getElementById("txtInfo");
    
        var count = LAppLive2DManager.instance.getCount();
        var curModelPath = LAppLive2DManager.instance.modelJsonList[count];

        txtInfo.textContent =
            "[" +
            (count + 1) +
            "/" +
            LAppLive2DManager.instance.modelJsonList.length +
            "] " +
            curModelPath;
        console.log("[curModelPath]", curModelPath);
        // console.log("[MD5]", curModelPath);
        LAppLive2DManager.instance.changeModel(this.gl, this.resize.bind(this));
    };


    mouseEvent(e) {
        e.preventDefault();
    
        if (e.type == "mousewheel") {
            if (
                e.clientX < 0 ||
                Live2DCanvasV2.instance.canvas.clientWidth < e.clientX ||
                e.clientY < 0 ||
                Live2DCanvasV2.instance.canvas.clientHeight < e.clientY
            ) {
                return;
            }
    
            if (e.wheelDelta > 0) Live2DCanvasV2.instance.modelScaling(1.1);
            // Scroll up to zoom in
            else Live2DCanvasV2.instance.modelScaling(0.9); // 下方向スクロール 縮小

        } else if (e.type == "mousedown") {
            // Exit if it's not a right-click
            if ("button" in e && e.button != 0) return;
            Live2DCanvasV2.instance.modelTurnHead(e);

        } else if (e.type == "mousemove") {
            if (e.buttons == 1) { // Left mouse button
                Live2DCanvasV2.instance.followPointer(e);

            } else if (e.buttons == 4) { // Middle mouse button
                Live2DCanvasV2.instance.modelPan(e);
            }

        } else if (e.type == "mouseup") {     
            if ("button" in e && e.button == 1) { // Middle mouse button
                if (!Live2DCanvasV2.instance.panning) { // We just clicked middle mouse button
                    Live2DCanvasV2.instance.resize()
                } else {
                    Live2DCanvasV2.instance.panning = false;
                }
            }
            
            // Exit if it's not a right-click
            if ("button" in e && e.button != 0) return;
            Live2DCanvasV2.instance.lookFront();

        } else if (e.type == "mouseout") {
            Live2DCanvasV2.instance.lookFront();
        }
    }


    startModelPan(event) {
        var rect = event.target.getBoundingClientRect();
        var vx = Live2DCanvasV2.instance.transformViewX(event.clientX - rect.left);
        var vy = Live2DCanvasV2.instance.transformViewY(event.clientY - rect.top);
        
        // Set the last mouse position to the current mouse position to prevent sudden jumps
        // when panning is started
        Live2DCanvasV2.instance.lastMouseX = vx;
        Live2DCanvasV2.instance.lastMouseY = vy;
    }


    modelPan(event) {
        if (Live2DCanvasV2.instance.panning == false) {
            Live2DCanvasV2.instance.panning = true;
            Live2DCanvasV2.instance.startModelPan(event)
        }
        
        var rect = event.target.getBoundingClientRect();
        var vx = Live2DCanvasV2.instance.transformViewX(event.clientX - rect.left);
        var vy = Live2DCanvasV2.instance.transformViewY(event.clientY - rect.top);

        // I don't know why adding to deltaX and deltaY need to be accumulated for
        // the correct smooth panning behaviour. Directly setting deltaX and deltaY
        // causes jitter
        var newDeltaX = Live2DCanvasV2.instance.deltaX + (vx - Live2DCanvasV2.instance.lastMouseX);
        var newDeltaY = Live2DCanvasV2.instance.deltaY + (vy - Live2DCanvasV2.instance.lastMouseY);

        Live2DCanvasV2.instance.lastMouseX = vx;
        Live2DCanvasV2.instance.lastMouseY = vy;
        
        var prevX = this.viewMatrix.tr[12];
        var prevY = this.viewMatrix.tr[13];

        // Scale the movement by the current zoom for consistency
        this.viewMatrix.adjustTranslate(
            newDeltaX * Live2DCanvasV2.instance.viewMatrix.getScaleX(), 
            newDeltaY * Live2DCanvasV2.instance.viewMatrix.getScaleY()
        );

        // If there was no change in the viewMatrix, then don't update deltaX and deltaY
        if (prevX != this.viewMatrix.tr[12]) {
            Live2DCanvasV2.instance.deltaX = newDeltaX;
        }
        if (prevY != this.viewMatrix.tr[13]) {
            Live2DCanvasV2.instance.deltaY = newDeltaY;
        }
    }


    touchEvent(e) {
        e.preventDefault();
    
        var touch = e.touches[0];
    
        if (e.type == "touchstart") {
            if (e.touches.length == 1) Live2DCanvasV2.instance.modelTurnHead(touch);
            // onClick(touch);
        } else if (e.type == "touchmove") {
            Live2DCanvasV2.instance.followPointer(touch);
    
            if (e.touches.length == 2) {
                var touch1 = e.touches[0];
                var touch2 = e.touches[1];
    
                var len =
                    Math.pow(touch1.pageX - touch2.pageX, 2) +
                    Math.pow(touch1.pageY - touch2.pageY, 2);
                if (Live2DCanvasV2.instance.oldLen - len < 0) Live2DCanvasV2.instance.modelScaling(1.025);
                // 上方向スクロール 拡大
                else Live2DCanvasV2.instance.modelScaling(0.975); // 下方向スクロール 縮小
    
                Live2DCanvasV2.instance.oldLen = len;
            }
        } else if (e.type == "touchend") {
            Live2DCanvasV2.instance.lookFront();
        }
    }


    /*
    * Zoom in/out with mouse wheel
    */
    modelScaling(scale) {
        var isMaxScale = Live2DCanvasV2.instance.viewMatrix.isMaxScale();
        var isMinScale = Live2DCanvasV2.instance.viewMatrix.isMinScale();

        Live2DCanvasV2.instance.viewMatrix.adjustScale(0, 0, scale);

        // 画面が最大になったときのイベント
        if (!isMaxScale) {
            if (Live2DCanvasV2.instance.viewMatrix.isMaxScale()) {
                LAppLive2DManager.instance.maxScaleEvent();
            }
        }
        // 画面が最小になったときのイベント
        if (!isMinScale) {
            if (Live2DCanvasV2.instance.viewMatrix.isMinScale()) {
                LAppLive2DManager.instance.minScaleEvent();
            }
        }
    }


    /*
    * Turn to the direction clicked
    * Play motion according to the tapped location
    */
    modelTurnHead(event) {
        Live2DCanvasV2.instance.drag = true;

        var rect = event.target.getBoundingClientRect();

        var sx = Live2DCanvasV2.instance.transformScreenX(event.clientX - rect.left);
        var sy = Live2DCanvasV2.instance.transformScreenY(event.clientY - rect.top);
        var vx = Live2DCanvasV2.instance.transformViewX(event.clientX - rect.left);
        var vy = Live2DCanvasV2.instance.transformViewY(event.clientY - rect.top);

        if (LAppDefine.DEBUG_MOUSE_LOG)
            l2dLog(
                "onMouseDown device( x:" +
                    event.clientX +
                    " y:" +
                    event.clientY +
                    " ) view( x:" +
                    vx +
                    " y:" +
                    vy +
                    ")"
            );

        Live2DCanvasV2.instance.lastMouseX = sx;
        Live2DCanvasV2.instance.lastMouseY = sy;

        Live2DCanvasV2.instance.dragMgr.setPoint(vx, vy); // Face that direction

        // Play motion according to the tapped location
        LAppLive2DManager.instance.tapEvent(vx, vy);
    }


    /*
    * Event when the mouse is moved
    */
    followPointer(event) {
        var rect = event.target.getBoundingClientRect();

        var sx = Live2DCanvasV2.instance.transformScreenX(event.clientX - rect.left);
        var sy = Live2DCanvasV2.instance.transformScreenY(event.clientY - rect.top);
        var vx = Live2DCanvasV2.instance.transformViewX(event.clientX - rect.left);
        var vy = Live2DCanvasV2.instance.transformViewY(event.clientY - rect.top);

        if (LAppDefine.DEBUG_MOUSE_LOG)
            l2dLog(
                "onMouseMove device( x:" +
                    event.clientX +
                    " y:" +
                    event.clientY +
                    " ) view( x:" +
                    vx +
                    " y:" +
                    vy +
                    ")"
            );

        if (Live2DCanvasV2.instance.drag) {
            Live2DCanvasV2.instance.lastMouseX = sx;
            Live2DCanvasV2.instance.lastMouseY = sy;

            Live2DCanvasV2.instance.dragMgr.setPoint(vx, vy); // Face that direction
        }
    }


    /*
    * Look straight ahead
    */
    lookFront() {
        if (Live2DCanvasV2.instance.drag) {
            Live2DCanvasV2.instance.drag = false;
        }

        Live2DCanvasV2.instance.dragMgr.setPoint(0, 0);
    }


    lookRandom() {
        if (this.isLookRandom) {
            var sx = Math.random() * 2.0 - 1.0;
            var sy = Math.random() * 2.0 - 1.0;
            this.dragMgr.setPoint(sx, sy);
            console.log("[lookRandom]", sx, sy);
        }
    }


    /* ********** Matrix Operations ********** */
    transformViewX(deviceX) {
        var screenX = Live2DCanvasV2.instance.deviceToScreen.transformX(deviceX); // 論理座標変換した座標を取得。
        return Live2DCanvasV2.instance.viewMatrix.invertTransformX(screenX); // 拡大、縮小、移動後の値。
    }

    transformViewY(deviceY) {
        var screenY = Live2DCanvasV2.instance.deviceToScreen.transformY(deviceY); // 論理座標変換した座標を取得。
        return Live2DCanvasV2.instance.viewMatrix.invertTransformY(screenY); // 拡大、縮小、移動後の値。
    }

    transformScreenX(deviceX) {
        return Live2DCanvasV2.instance.deviceToScreen.transformX(deviceX);
    }

    transformScreenY(deviceY) {
        return Live2DCanvasV2.instance.deviceToScreen.transformY(deviceY);
    }


    saveLayer(dir = path.join(outputRoot, "layer")) {
        // Create dir
        fs.mkdirSync(dir, { recursive: true });
    
        // Keep previous playing state, and set to pause to stop calling draw()
        var prevIsPlay = this.isPlay;
        this.isPlay = false;
    
        // Remember to update the model before calling getElementList()
        var model = LAppLive2DManager.instance.getModel(0);
        model.update(this.frameCount);
        var elementList = model.live2DModel.getElementList();
    
        // Save images for each element
        MatrixStack.reset();
        MatrixStack.loadIdentity();
        MatrixStack.multMatrix(this.projMatrix.getArray());
        MatrixStack.multMatrix(this.viewMatrix.getArray());
        MatrixStack.push();
    
        // Draw an image with all elements
        viewer.save(path.join(dir, "all.png"));
    
        elementList.forEach((item, index) => {
            var element = item.element;
            var partID = item.partID;
            var order = ("000" + index).slice(-4);
            gl.clear(gl.COLOR_BUFFER_BIT);
            model.drawElement(gl, element);
            // Separate directory for each partID
            if (!fs.existsSync(path.join(dir, partID))) {
                fs.mkdirSync(path.join(dir, partID));
            }
            viewer.save(path.join(dir, partID, order + "_" + partID + ".png"));
        });
    
        MatrixStack.pop();
    
        this.isPlay = prevIsPlay;
    };


    save(filepath = path.join(outputRoot, "image.png")) {
        // Save canvas to png file
        var img = this.canvas.toDataURL();
        var data = img.replace(/^data:image\/\w+;base64,/, "");
        var buf = Buffer.from(data, "base64");
        fs.writeFileSync(filepath, buf);
    };
}
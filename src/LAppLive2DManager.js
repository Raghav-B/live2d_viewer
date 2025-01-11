const { TouchBarOtherItemsProxy } = require("electron");

class LAppLive2DManager {
    
    constructor() {
        if (LAppLive2DManager.instance) {
            return LAppLive2DManager.instance;
        }
        LAppLive2DManager.instance = this;
        
        this.modelJsonList = [];

        // Model data
        this.models = []; // LAppModel

        // Sample functionality
        this.count = 0;
        this.reloadFlg = false; // Flag for reloading the model

        Live2D.init();
        Live2DFramework.setPlatformManager(new PlatformManager());
    }


    getCount() {
        if (this.count < 0) this.count = 0;
        let parsedInt = parseInt(this.count % this.modelJsonList.length);
        if (!parsedInt) {
            return 0;
        }
        return parsedInt;
    };


    setModelJsonList(modelJsonList) {
        this.modelJsonList = modelJsonList;
    };


    createModel() {
        var model = new LAppModel();
        this.models.push(model);

        return model;
    };


    changeModel(gl, callback = null) {
        if (this.reloadFlg) {
            // Reload the model when the model change button is pressed
            this.reloadFlg = false;

            var no = this.getCount();
            this.releaseModel(0, gl);
            this.createModel();
            this.models[0].load(gl, this.modelJsonList[no], callback);
        }
    };


    getModel(no) {
        if (no >= this.models.length) return null;
        return this.models[no];
    };


    /*
    * Release the model
    * Do nothing if it does not exist
    */
    releaseModel(no, gl) {
        if (this.models.length <= no) return;

        this.models[no].release(gl);

        delete this.models[no];
        this.models.splice(no, 1);
    };


    /*
    * Number of models
    */
    numModels() {
        return this.models.length;
    };


    /*
    * Set the model to face the direction of the drag
    */
    setDrag(x, y) {
        for (var i = 0; i < this.models.length; i++) {
            this.models[i].setDrag(x, y);
        }
    };


    /*
    * Event when the screen is maximized
    */
    maxScaleEvent() {
        if (LAppDefine.DEBUG_LOG) console.log("Max scale event.");
        for (var i = 0; i < this.models.length; i++) {
            this.models[i].startRandomMotion(
                LAppDefine.MOTION_GROUP_PINCH_IN,
                LAppDefine.PRIORITY_NORMAL
            );
        }
    };


    /*
    * Event when the screen is minimized
    */
    minScaleEvent() {
        if (LAppDefine.DEBUG_LOG) console.log("Min scale event.");
        for (var i = 0; i < this.models.length; i++) {
            this.models[i].startRandomMotion(
                LAppDefine.MOTION_GROUP_PINCH_OUT,
                LAppDefine.PRIORITY_NORMAL
            );
        }
    };


    // Added functionality @jeffshee
    prevIdleMotion() {
        for (var i = 0; i < this.models.length; i++) {
            var ret = this.models[i].startPrevIdleMotion();
            if (!ret) {
                console.log("[nextIdleMotion] start of the list is reached");
                return false;
            }
        }
        return true;
    };


    nextIdleMotion() {
        for (var i = 0; i < this.models.length; i++) {
            var ret = this.models[i].startNextIdleMotion();
            if (!ret) {
                console.log("[nextIdleMotion] end of the list is reached");
                return false;
            }
        }
        return true;
    };


    currentIdleMotion() {
        for (var i = 0; i < this.models.length; i++) {
            // return this.models[i].getCurrentIdleMotion();
            return this.models[i].currentIdleMotion;
        }
        return 0;
    }


    idleMotionNum() {
        for (var i = 0; i < this.models.length; i++) {
            return this.models[i].getIdleMotionNum();
        }
        return 0;
    }


    getMocPath() {
        for (var i = 0; i < this.models.length; i++) {
            return this.models[i].modelPath;
        }
        return 0;
    }


    /*
    * Event when tapped
    */
    tapEvent(x, y) {
        if (LAppDefine.DEBUG_LOG) console.log("tapEvent view x:" + x + " y:" + y);

        for (var i = 0; i < this.models.length; i++) {
            if (this.models[i].hitTest(LAppDefine.HIT_AREA_HEAD, x, y)) {
                // 顔をタップしたら表情切り替え
                if (LAppDefine.DEBUG_LOG) console.log("Tap face.");

                this.models[i].setRandomExpression();
            } else if (this.models[i].hitTest(LAppDefine.HIT_AREA_BODY, x, y)) {
                // 体をタップしたらモーション
                if (LAppDefine.DEBUG_LOG)
                    console.log("Tap body." + " models[" + i + "]");

                this.models[i].startRandomMotion(
                    LAppDefine.MOTION_GROUP_TAP_BODY,
                    LAppDefine.PRIORITY_NORMAL
                );
            }
        }

        return true;
    };
}

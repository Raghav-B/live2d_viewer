const crypto = require("crypto");
const fs = require("fs");
const path = require("path");
const nativeTheme = require("electron");
const { timeStamp, time } = require("console");

nativeTheme.themeSource = "dark";

// Parameters
const datasetRoot = "dataset"; // Root of dataset directory
const outputRoot = "output"; // Root of output directory
const blacklistPath = path.join(outputRoot, "blacklist.txt"); // Blacklist path
const ignoreGeneratedJson = true; // Ignore the generated JSON file
const ignoreOriginalJson = true; // Ignore the original JSON file
const batchOperationMinDelay = 1000;
const batchOperationDelayRange = 1000;

let modelJsonIds = {};


var getPartIDs = function (modelImpl) {
    let partIDs = [];
    partsDataList = modelImpl._$Xr();
    partsDataList.forEach((element) => {
        partIDs.push(element._$NL.id);
    });
    return partIDs;
};


var getParamIDs = function (modelImpl) {
    let paramIDs = [];
    paramDefSet = modelImpl._$E2()._$4S;
    paramDefSet.forEach((element) => {
        paramIDs.push(element._$wL.id);
    });
    return paramIDs;
};


// Capture errors that occur in JavaScript
window.onerror = function (msg, url, line, col, error) {
    var errmsg = "file:" + url + "<br>line:" + line + " " + msg;
    l2dError(errmsg);
};


function viewer() {
    this.platform = window.navigator.platform.toLowerCase();
    this.live2DMgr = new LAppLive2DManager();
    
    // Shortcut keys
    document.addEventListener("keydown", function (e) {
        var keyCode = e.keyCode;
        if (keyCode == 90) {
            // z key
            curCanvas.changeModel(-1);
        } else if (keyCode == 88) {
            // x key
            curCanvas.changeModel(1);
        } else if (keyCode == 32) {
            // space key
            curCanvas.flagBlacklist();
        }
    });

    this.blacklist = [];
    if (fs.existsSync(blacklistPath)) {
        this.blacklist = fs.readFileSync(blacklistPath).toString().split("\n");
        // Append datasetRoot to the paths
        this.blacklist.forEach((item, index) => {
            this.blacklist[index] = path.join(datasetRoot, item);
        });
    }

    // Initialize canvases for model rendering
    this.v2Canvas = new Live2DCanvasV2();
    // this.v3Canvas = new Live2DCanvasV3();
    this.curCanvas = this.v2Canvas;

    // Initialize UI interactions
    viewer.init_interactions();
}


viewer.init_interactions = function () {
    // Initialize UI components
    btnPrev = document.getElementById("btnPrev");
    btnNext = document.getElementById("btnNext");
    btnPrev.addEventListener("click", function (e) {
        curCanvas.changeModel(-1);
    });
    btnNext.addEventListener("click", function (e) {
        curCanvas.changeModel(1);
    });

    btnGoto = document.getElementById("btnGoto");
    btnGoto.addEventListener("click", function (e) {
        viewer.goto();
    });

    btnPlayPause = document.getElementById("btnPlayPause");
    btnPlayPause.addEventListener("click", function (e) {
        viewer.togglePlayPause();
    });
    btnPlayPause.textContent = curCanvas.isPlay ? "Pause" : "Play";

    btnSave = document.getElementById("btnSave");
    btnSave.addEventListener("click", function (e) {
        curCanvas.save();
    });

    btnSaveLayer = document.getElementById("btnSaveLayer");
    btnSaveLayer.addEventListener("click", function (e) {
        curCanvas.saveLayer();
    });

    btnSecret = document.getElementById("btnSecret");
    btnSecret.addEventListener("click", function (e) {
        viewer.secret();
    });

    btnBatch = document.getElementById("btnBatch");
    btnBatch.addEventListener("click", function (e) {
        viewer.batch();
    });

    btnResize = document.getElementById("btnResize");
    btnResize.addEventListener("click", function (e) {
        curCanvas.resize();
    });

    btnLookRandom = document.getElementById("btnLookRandom");
    btnLookRandom.addEventListener("click", function (e) {
        curCanvas.toggleLookRandom();
    });

    btnPrevMotion = document.getElementById("btnPrevMotion");
    btnPrevMotion.addEventListener("click", function (e) {
        live2DMgr.prevIdleMotion();
    });
    btnNextMotion = document.getElementById("btnNextMotion");
    btnNextMotion.addEventListener("click", function (e) {
        live2DMgr.nextIdleMotion();
    });
};


viewer.goto = function () {
    var folderPath = document.getElementById("loadModelDir").value;
    
    // Load all models
    let filelist = [];
    walkdir(datasetRoot + "/" + folderPath, function (filepath) {
        filelist.push(filepath);
    });
    var modelJsonList = loadModel(filelist);

    live2DMgr.setModelJsonList(modelJsonList);
    
    live2DMgr.count = 0;
    curCanvas.changeModel(0);
    curCanvas.startDraw();
};


viewer.togglePlayPause = function () {
    curCanvas.togglePlayPause();
    btnPlayPause.textContent = curCanvas.isPlay ? "Pause" : "Play";
};


viewer.secret = function () {
    // Print model stat
    var live2DModel = live2DMgr.getModel(0).live2DModel;
    var modelImpl = live2DModel.getModelImpl();

    console.log("[getPartIDs]", getPartIDs(modelImpl));
    console.log("[getParamIDs]", getParamIDs(modelImpl));

    parts = modelImpl._$F2;
    partsCount = parts.length;
    var elementCount = 0;
    parts.forEach((element) => {
        console.log(element.getDrawData());
        elementCount += element.getDrawData().length;
    });
    console.log("[partCount]", partsCount);
    console.log("[elementCount]", elementCount);
};


// TODO
viewer.batch = function () {
    var count = live2DMgr.getCount();
    op = function () {
        if (count < live2DMgr.modelJsonList.length) {
            var curModelPath = live2DMgr.modelJsonList[count];
            var id = modelJsonIds[curModelPath];
            var curMotion = live2DMgr.currentIdleMotion();
            var progress =
                "[" +
                (count + 1) +
                "/" +
                live2DMgr.modelJsonList.length +
                "] " +
                "[" +
                (curMotion + 1) +
                "/" +
                live2DMgr.idleMotionNum() +
                "] " +
                curModelPath;
            console.log("[batch]", progress);
            var tag =
                ("000" + (id + 1)).slice(-4) +
                "_mtn" +
                ("0" + (curMotion + 1)).slice(-2);
            var dir = path.join(outputRoot, tag);
            console.log("[batch] output to", dir);
            fs.mkdirSync(dir, { recursive: true });
            curCanvas.saveLayer(dir);
            if (!live2DMgr.nextIdleMotion()) {
                viewer.changeModel(1);
                count++;
            }
            // Make a delay here
            var delay =
                batchOperationMinDelay +
                Math.floor(Math.random() * batchOperationDelayRange);
            console.log(
                "[batch] next operation will be started after",
                delay,
                "ms"
            );
            setTimeout(op, delay);
        }
    };
    // Start op
    op();
};


viewer.flagBlacklist = function () {
    var count = live2DMgr.getCount();
    var curModelPath = live2DMgr.modelJsonList[count];
    relativeCurModelPath = curModelPath.slice(datasetRoot.length + 1); // Include the '/'
    fs.appendFileSync(blacklistPath, relativeCurModelPath + "\n");
    console.log("[flagBlacklist]", "Flagged " + relativeCurModelPath);
};


function prettyPrintEveryJson() {
    walkdir(datasetRoot, (file) => {
        if (file.endsWith(".json")) {
            j = fs.readFileSync(file).toString();
            try {
                fs.writeFileSync(file, JSON.stringify(JSON.parse(j), null, 3));
            } catch (error) {
                console.error("JSON Parse Error", file);
            }
        }
    });
}


function md5file(filePath) {
    const target = fs.readFileSync(filePath);
    const md5hash = crypto.createHash("md5");
    md5hash.update(target);
    return md5hash.digest("hex");
}


function loadModel(filelist) {
    let modelJsonList = [];
    filelist.forEach((filepath) => {
        if (filepath.endsWith(".moc") || filepath.endsWith(".moc3")) {
            modelJson = loadModelJson(filepath);
            if (modelJson) {
                modelJsonList.push(...modelJson);
            }
        }
    });
    modelJsonList = [...new Set(modelJsonList)];
    modelJsonList.forEach((value, index) => {
        modelJsonIds[value] = index;
    });
    // Filter out the blacklisted models
    modelJsonList = modelJsonList.filter(function (e) {
        return this.indexOf(e) < 0;
    }, this.blacklist);
    console.log("[loadModel]", modelJsonList.length + " model loaded");
    return modelJsonList;
}


function loadModelJson(mocPath) {
    pardir = path.dirname(mocPath);
    let textures = []; // *.png
    let physics; // *.physics or physics.json
    let pose; // pose.json
    let expressions = []; // *.exp.json
    let motions = []; // *.mtn
    let modelJson = [];
    walkdir(pardir, function (filepath) {
        if (filepath.endsWith(".png")) {
            textures.push(filepath.replace(pardir + "/", ""));
        }
        if (
            filepath.endsWith(".physics") ||
            filepath.endsWith("physics.json")
        ) {
            physics = filepath.replace(pardir + "/", "");
        }
        if (filepath.endsWith("pose.json")) {
            pose = filepath.replace(pardir + "/", "");
        }
        if (filepath.endsWith(".mtn")) {
            motions.push(filepath.replace(pardir + "/", ""));
        }
        if (filepath.endsWith(".exp.json")) {
            expressions.push(filepath.replace(pardir + "/", ""));
        }
        if (filepath.endsWith("generated.model.json")) {
            if (!ignoreGeneratedJson) {
                modelJson.push(filepath);
            }
        } else if (filepath.endsWith("model.json")) {
            if (!ignoreOriginalJson) {
                modelJson.push(filepath);
            }
        }
    });
    // Generate a JSON file based on all the resources we can find
    if (modelJson.length == 0) {
        if (textures.length == 0) {
            console.warn(
                "[loadModelJson]",
                "0 texture found! .moc path: " + mocPath
            );
            // Usually is a corrupted model, ignore
            return;
        }
        textures.sort();
        motions.sort();
        var model = {};
        model["version"] = "AutoGenerated 1.0.0";
        model["model"] = mocPath.replace(pardir + "/", "");
        model["textures"] = textures;
        if (physics) model["physics"] = physics;
        if (pose) model["pose"] = pose;
        if (expressions.length > 0) {
            model["expressions"] = [];
            expressions.forEach((expression) => {
                model["expressions"].push({
                    file: expression,
                    name: path.basename(expression),
                });
            });
        }
        if (motions.length > 0) {
            model["motions"] = { idle: [] };
            motions.forEach((motion) => {
                model["motions"]["idle"].push({ file: motion });
            });
        }
        json = JSON.stringify(model, null, 3);
        generatedJsonPath = path.join(pardir, "generated.model.json");
        modelJson.push(generatedJsonPath);
        fs.writeFileSync(generatedJsonPath, json);
    }
    return modelJson;
}


function walkdir(dir, callback) {
    const files = fs.readdirSync(dir);
    files.forEach((file) => {
        var filepath = path.join(dir, file);
        const stats = fs.statSync(filepath);
        if (stats.isDirectory()) {
            walkdir(filepath, callback);
        } else if (stats.isFile()) {
            callback(filepath);
        }
    });
}


/*
 * Output screen error
 */
function l2dError(msg) {
    if (!LAppDefine.DEBUG_LOG) return;
    console.error(msg);
}

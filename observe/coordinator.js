!(function(){

    let _ = require("underscore");
    require("underscore_extension")(_);

    ////////////////////////////////////////////////////////////////////////////

    module.exports = Coordinator;
    ////////////////////////////////////////////////////////////////////////
    //
    // 協調者
    // 作為 data 與 watch 間的協調
    //
    ////////////////////////////////////////////////////////////////////////
    function Coordinator(ob, watchOptions) {
        // debugger;

        this.$$fn = Coordinator;
        this.$$cid;
        // 與他協調的觀察者
        this.$$ob;
        //----------------------------
        // 用此速度會變慢，各模組要各自再比較數據
        // 可能會重複不少步驟，暫時停用
        this.$$listenerMap = new Map();

        // 使用者設定的 watch
        this.$$user_watchRuleList = [];

        // 給外部模組用
        // 與一般使用者分開
        this.$$module_watchRuleList = [];
        //----------------------------
        // 可決定是否要反應
        // 還是安靜的更新數據
        this.$$reaction = true;
        //----------------------------
        this.__construct(ob, watchOptions);
    }
    //----------------------------
    try {
        // 讓 Observe 有 events
        // _.event(Coordinator.prototype);
    } catch (error) {
        console.dir(error);
    }
    //======================================================================
    (function (_self) {
        _self.$$uid = 0;
    })(Coordinator);

    //======================================================================
    (function () {
        this.__construct = function (ob, watchOptions) {
            // debugger;
            this.$$cid = "Coordinator_" + this.$$fn.$$uid++;

            this.$$ob = ob;

            // 建構 watch 並與之連結
            // this.$$addWatch(watchOptions, this.$$user_watchRuleList);

        };
        //======================================================================
        // 數據操作
        // 設定數據
        this.set = function (path, value) {
            let pathList = [];
            let key;


            path = $tool.filterPath(path);
            pathList = path.split('.');
            key = pathList.pop();

            if (key == null || key.length == 0) {
                throw new Error('no set key');
            }
            //----------------------------
            if (!this.$$has(pathList)) {
                throw new Error("can't set()");
            }

            let data = this.$$get(pathList);

            if (!Array.isArray(data) || !_.isPlainObject(data)) {
                throw new Error("can't set()");
            }

            data[key] = value;
        };
        //======================================================================
        // 數據操作
        // 取得數據
        this.get = function (path, noProxy) {
            let pathList = [];
            let key;

            if (typeof path === 'string' && path.length != 0) {
                path = $tool.filterPath(path);
                pathList = path.split('.');
            }

            return this.$$get(pathList, noProxy);
        };
        //======================================================================
        // 數據操作
        this.$$get = function (pathList, noProxy) {
            if (noProxy) {
                return this.$$path_clearValue(pathList);
            } else {
                return this.$$path_proxy(pathList);
            }
        };
        //======================================================================
        // 刪除數據
        this.delete = function (path) {
            let pathList = [];
            let data;
            let key;

            path = $tool.filterPath(path);
            pathList = path.split('.');
            key = pathList.pop();

            if (key == null || key.length == 0) {
                return undefined;
            }

            data = this.$$path_proxy(pathList);
            let res;

            if (Array.isArray(data)) {
                key = Number(key);
                res = data[key];
                data.splice(key, 1);
            } else if (_.isPlainObject(data)) {
                res = data[key];
                delete data[key];
            } else {
                return undefined;
            }
            return res;
        };
        //======================================================================
        // 數據操作
        // 是否有設定此數據
        this.has = function (path) {
            debugger;
            path = $tool.filterPath(path);
            let pathList = path.split('.');

            return this.$$has(pathList);
        };
        //======================================================================
        // 數據操作
        this.$$has = function (pathList) {
            let length = pathList.length;
            let data = this.$$ob.$$proxy;

            let key;

            while ((key = pathList.shift()) !== undefined) {
                // debugger;

                if (data == null) {
                    return false;
                }

                if (!data.hasOwnProperty(key)) {
                    return false;
                }
                //----------------------------
                if (Array.isArray(data)) {
                    data = data[Number(key)];
                } else {
                    data = data[key];
                }
            }
            return true;
        };
        //======================================================================
        // 關閉數據響應
        this.off = function () {
            this.$$reaction = false;
        };
        //======================================================================
        // 打開數據響應
        this.on = function () {
            this.$$reaction = true;
        };
        //======================================================================
        // 命令與其合作的模組強制更新
        this.update = function () {
            this.$$reaction = true;

            this.$$module_watchRuleList.forEach(function (watchRule) {
                watchRule.$update();
            }, this);

            this.$$user_watchRuleList.forEach(function (watchRule) {
                watchRule.$update();
            }, this);

        };
        //======================================================================
        // 使用者 API
        // options = [{name, handler, rule}]
        this.addWatch = function (options) {
            this.$$addWatch(options, this.$$user_watchRuleList);
        };

        // 開放給外部其他模組用
        // 與使用者操作分開
        // options = [{name, handler, rule, module}]
        this.addWatchByModule = function (callsign, options) {
            this.$$addWatch(options, this.$$module_watchRuleList, true);
        };
        //======================================================================
        // 使用者 API
        // options => {rule, deep} 根據給的這兩個 key 來移除
        this.removeWatch = function (options, name) {
            // 未
            // 檢查 this.$$user_watchRuleList
        };
        // 開放給外部其他模組用
        // 與使用者操作分開
        // options => {module, rule, deep} 根據給的這兩個 key 來移除
        this.removeWatchByModule = function (options, name) {
            // 未
            // 檢查 this.$$module_watchRuleList
        };
        //======================================================================

        // 被數據變動的觀察者呼叫
        // pathKeyList => 有哪些更改過的 path
        this.$$notify = function (eventName, pathList) {
            debugger;
            console.log("---------↓ coordinator notify ↓-----------");
           
            console.log("coordinator(%s)=>%s", this.$$cid, JSON.stringify(pathList));

            // 產生規矩
            // let ruleList = this.$$generateRule(pathList);

            // console.dir(ruleList);
            // console.log(JSON.stringify(ruleList));
            console.log("---------↑ coordinator notify ↑-----------");

            // 提醒所屬的 watch
            // this.$$notifyWatchs(ruleList);


        };
        //==================================================================
        // 建構 watch 並與之連結
        this.$$addWatch = function (watchOptions, watchRuleList, operateByModule) {
            debugger;

            operateByModule = operateByModule || false;

            if (watchOptions == null) {
                watchOptions = [];
            } else if (_.isPlainObject(watchOptions)) {
                watchOptions = [watchOptions];
            }

            for (let i = 0; i < watchOptions.length; i++) {

                let options = watchOptions[i];

                if (operateByModule && typeof options !== 'string') {
                    throw new Error('watch options no set moduleName')
                }

                let rule = options['rule'];
                let deep = (typeof options['deep'] === 'number' ? options['deep'] : 1);

                if (typeof rule === 'string') {

                    rule = $tool.filterPath(rule);

                } else if (typeof rule === 'function') {

                    if (typeof rule['_bc_eventGuid'] === 'undefined') {
                        _.defineProperty(rule, "_bc_eventGuid", $extension.callback_guid++, false);
                    }
                }

                options['deep'] = deep;
                options['rule'] = rule;

                // 根據使用者給的 watchSetting，以[rule, deep]為 key
                // 找出所屬的 watchRule
                let watchRule = this.$$findWatchRule(options, watchRuleList);

                // 相應(rule, deep)的 watchRule，給予一個 job
                watchRule.addJob(options);
            }
        };
        //==================================================================
        // 根據使用者給的 watchSetting，以[rule, deep]為 key
        // 找出所屬的 watchRule
        this.$$findWatchRule = function (options, watchRuleList) {

            let rule = options['rule'];
            let deep = options['deep'];
            let watchRule;
            for (let i = 0; i < watchRuleList.length; i++) {
                watchRule = watchRuleList[i];

                if (typeof rule !== typeof watchRule.$$originRule) {
                    continue;
                }

                if (deep !== watchRule.$$deep) {
                    continue;
                }

                if (typeof rule === 'function' &&
                        watchRule.$$originRule._bc_eventGuid === rule._bc_eventGuid) {
                    return watchRule;
                } else if (typeof rule === 'string' && watchRule.$$originRule === rule) {
                    return watchRule;
                }
            }
            //----------------------------
            // 根據 rule, deep 沒找到相符的(watchRule)

            watchRule = new WatchRule(this, options);
            watchRuleList.push(watchRule);

            return watchRule;
        };
        //==================================================================
        // 整理 pathList
        // 抓出屬於自己的 pathList
        this.$$generateRule = function (pathList) {
            // debugger;

            let ruleList = [];

            for (let i = 0; i < pathList.length; i++) {
                // debugger;
                let path = pathList[i].slice();
                let cd = path.shift();

                if (cd.$$cid === this.$$cid) {
                    let pathString = path.join(".");

                    let reg = pathString.replace(/\./g, "\\.");
                    reg = new RegExp(("^" + reg), "i");

                    let rule = {
                        pathString: pathString,
                        reg: reg
                    };

                    ruleList.push(rule);
                }
            }
            return ruleList;
        };

        //==================================================================
        // 提醒所屬的 watch
        this.$$notifyWatchs = function (ruleList) {
            debugger;

            this.$$module_watchRuleList.forEach(function (watchRule) {
                watchRule.$notify(ruleList, this.$$reaction);
            }, this);

            this.$$user_watchRuleList.forEach(function (watchRule) {
                watchRule.$notify(ruleList, this.$$reaction);
            }, this);
        };
        //==================================================================
        // 根據path 取得 value(非proxy)
        // 被 WatchItem 呼叫
        this.$$path_clearValue = function (pathList) {

            let data = this.$$ob.$$value;
            let key;
            while ((key = pathList.shift()) !== undefined) {

                if (data == null) {
                    return undefined;
                }

                if (!data.hasOwnProperty(key)) {
                    return undefined;
                }
                //----------------------------
                if (Array.isArray(data)) {
                    data = data[Number(key)];
                } else {
                    data = data[key];
                }
                //----------------------------
                // 取出乾淨的數據(非 proxy)
                if (typeof data === 'object' && data != null &&
                        typeof data.__us_ob__ !== 'undefined') {
                    data = data.__us_ob__.$$value;
                }
            }
            //---------------------
            return data;
        };
        //==================================================================
        // 根據 path 取出數據
        this.$$path_proxy = function (pathList) {
            let data = this.$$ob.$$proxy;

            let key;
            while ((key = pathList.shift()) !== undefined) {

                if (data == null) {
                    return undefined;
                }

                if (!data.hasOwnProperty(key)) {
                    return undefined;
                }
                //----------------------------
                if (Array.isArray(data)) {
                    data = data[Number(key)];
                } else {

                    data = data[key];
                }
            }
            //---------------------
            return data;
        };
        //==================================================================
        this.toJSON = function(){
            return this.$$cid;
        };
    }).call(Coordinator.prototype);
})();

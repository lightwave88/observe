!(function () {

    let _ = require("underscore");
    require("underscore_extension")(_);

    const Coordinator = require("./coordinator.js");
    ////////////////////////////////////////////////////////////////////////////
    const arrayProto = Array.prototype;

    // 用來覆蓋 [].methods
    // 並在 [].methods 裡面埋入監視者
    const arrayProtoClone = Object.create(arrayProto);
    //----------------------------
    // array 要監視的方法
    const arrayMethodsNameList = [
        'push',
        'pop',
        'shift',
        'unshift',
        'splice',
        'sort',
        'reverse'
    ];
    //======================================================================
    // 為 arrayProtoClone.method 插入觀察者
    arrayMethodsNameList.forEach(function (method) {

        // array 原始的方法
        const original = arrayProto[method];

        // 在 array.proto 寫下方法
        _.defineProperty(arrayProtoClone, method, function arrayReact() {
            debugger;

            // 裡面會有 remove, add ,update
            let args = Array.from(arguments);
            //----------------------------
            let preValue = this.slice();
            let ob = this.__us_ob__;
            ob.$$arrayMethod = method;

            // array數值變動
            let result = original.apply(this, args);

            debugger;

            let add = [];
            let remove = [];

            let removeKeyList = [];

            // debugger;

            switch (method) {
                case 'push':
                    add = args;
                    break;
                case 'unshift':
                    add = args;
                    break;
                case 'pop':
                    remove = result;
                    let removeKey = preValue.length - 1;
                    removeKey < 0 ? 0 : removeKey;
                    removeKeyList.push(removeKey);
                    break;
                case 'shift':
                    remove = result;
                    removeKeyList.push(0);
                    break;
                case 'splice':
                    debugger;
                    add = args.slice(2);
                    remove = result;

                    let delStart = args[0];

                    if (delStart != null) {

                        let delLength = (function () {
                            let res = preValue.length - delStart;
                            if (args[1] != null) {
                                res = (args[1] > res) ? res : args[1];
                            }
                            return res;
                        })();

                        for (let i = 0; (i < delLength); i++) {
                            let index = delStart + i;
                            removeKeyList.push(i);
                        }
                    }
                    break;
            }

            if (!Array.isArray(add)) {
                add = (add === undefined ? [] : [add]);
            }

            if (!Array.isArray(remove)) {
                remove = (remove === undefined ? [] : [remove]);
            }
            //----------------------------

            ob.$$_notify_by_arrayMethod(method, preValue, removeKeyList, add, remove);

            return result;
        });
    });
    //======================================================================

    const augment = function (target, src, keys) {
        if ('__proto__' in {}) {
            target.__proto__ = src;
        } else {
            for (let i = 0, l = keys.length; i < l; i++) {
                let key = keys[i];
                _.defineProperty(target, key, src[key]);
            }
        }
    };
    //======================================================================
    const cloneProxyValue = function (value) {
        let res = value;
        if (typeof (value) == "object" && value != null) {
            res = JSON.parse(JSON.stringify(value));
        }
        return res;
    };
    //======================================================================
    const isObject = function (value) {
        if (value == null) {
            return false;
        }

        if (typeof (value) != "object") {
            return false;
        }

        return true;
    };
    ////////////////////////////////////////////////////////////////////////////
    //
    // 在數據後面設置觀察者
    //
    ////////////////////////////////////////////////////////////////////////////

    module.exports = makeObserver;

    // start here
    // options = {
    //  link: 讓 parent, child 連結的函式
    // }
    // parent, key => 內部使用

    function makeObserver(value) {
        // debugger;

        // 檢查數據類型
        // 數據檢查

        if (!Array.isArray(value) && !_.isPlainObject(value)) {
            throw new TypeError('_.observe(data) data must be [],{}');
        }
        //----------------------------
        let observe;
        let res;


        if (value.__us_ob__ == null) {
            // 數據從未指派過 observe
            observe = new JSONObserver(value);

            // 可移到 JSONObserver.construct 裏
            _.defineProperty(value, '__us_ob__', observe);

            if (Array.isArray(value)) {

                JSONObserver.$$walkArray(value);

                let arrayKeys = Object.getOwnPropertyNames(Array.prototype);

                // 替換 [] 的原型方法
                augment(value, arrayProtoClone, arrayKeys);


            } else if (_.isPlainObject(value)) {

                JSONObserver.$$walkPlainObject(value);
            }
        } else {
            observe = value.__us_ob__;
        }
        // debugger;
        //----------------------------
        res = observe.$$proxy;

        return res;
    }


    ////////////////////////////////////////////////////////////////////////
    //
    // 數據的背後觀察者
    // 放在數據的(__us_ob__)裏，並且不可枚舉
    //
    // 要加入 controller 找數據底下的 __us_ob__
    //
    ////////////////////////////////////////////////////////////////////////
    // options => [remove]
    function JSONObserver(value) {
        this.fn = JSONObserver;
        this.$$cid;
        //----------------------------
        this.$$proxy;
        this.$$value; // 只能是 object
        this.$$prev_value;
        //----------------------------
        this.$$arrayMethod = null; // for judge

        // 紀錄有哪些 parent
        // 方便形成路徑
        this.$$parentsMap = new Map();

        // 當收到數據變動事件
        // 收集要通知的 coordinator
        this.$$coordinatorMap = {};

        // 協調者
        this.$$coordinator;
        // 動態記錄，是否已離開數據樹
        this.$$pathList = {};
        //----------------------------
        // 紀錄那些 key 有變動
        this.$$changeKeys = new Set();
        //----------------------------
        this.__construct(value);
    }
    //==========================================================================
    // 類別方法
    (function (fn) {
        fn.$$uid = 0;

        //======================================================================
        // 確定 {} 的屬性都會成為 observer
        fn.$$walkPlainObject = function (obj) {

            let observe = obj.__us_ob__;

            for (let k in obj) {
                let child = obj[k];
                let newValue = fn._observe(child, observe, k);
                obj[k] = newValue;
            }
        };
        //======================================================================
        // 確定 [] 的屬性都會成為 observer
        fn.$$walkArray = function (items) {
            let observe = items.__us_ob__;
            for (let i = 0, l = items.length; i < l; i++) {

                let child = items[i];
                let newValue = fn._observe(child, observe, i);
                items[i] = newValue;
            }
        };
        //======================================================================

        fn._observe = function (value, parent, key) {
            // debugger;

            if (!isObject(value)) {
                return value;
            }

            let ob;

            if (value.hasOwnProperty('__us_ob__')) {
                ob = value.__us_ob__;

            } else if ((Array.isArray(value) || _.isPlainObject(value))) {
                // 進入遞迴
                value = makeObserver(value);
                ob = value.__us_ob__;

            } else {
                throw new Error("...........");
            }
            //----------------------------
            if (ob) {
                // 此步驟物最主要的步驟
                // 與 parent 連結
                ob.$$addParent(parent, key);
            }

            return value;
        }
    })(JSONObserver);

    //==========================================================================

    (function () {
        this.__construct = function (value) {
            this.$$cid = ("observer_" + (this.fn.$$uid++));
            this.$$value = value;

            this.$$wrapProxy();
        };
        //======================================================================
        // 在外層包 proxy
        // 利用 proxy 監聽的性質
        this.$$wrapProxy = function () {
            if (Array.isArray(this.$$value)) {
                this.$$proxy = new Proxy(this.$$value, {
                    set: function (t, k, v, p) {
                        debugger;

                        let preValue;
                        let old_o;
                        let eventName = 'change';

                        let ob = t.__us_ob__;

                        if (!ob.$$arrayMethod) {
                            preValue = cloneProxyValue(t);
                        }

                        //----------------------------
                        if (/length/i.test(k)) {
                            // length 改變，造成 delete

                            let prevLength = t[k];
                            t[k] = v;
                            ob.$$_notify_by_lengthChange(t, prevLength, v, preValue);

                            return true;
                        }
                        //----------------------------
                        if (typeof (t[k]) == 'undefined') {
                            eventName = 'add';
                        } else {
                            if (isObject(t[k]) && t[k].__us_ob__ != null) {
                                old_o = t[k].__us_ob__;
                            }
                        }
                        //----------------------------
                        let _v = JSONObserver._observe(v, ob, k);
                        debugger;

                        t[k] = _v;
                        //----------------------------
                        ob.$$_notify_by_proxyChange(eventName, k, old_o, preValue);

                        return true;
                    },
                    deleteProperty: function (t, k) {
                        debugger;

                        let preValue;
                        let ob = t.__us_ob__;
                        let old_o;

                        if (!ob.$$arrayMethod) {
                            preValue = cloneProxyValue(t);
                        }

                        if (isObject(t[k]) && t[k].__us_ob__ != null) {
                            old_o = t[k].__us_ob__;
                        }

                        delete t[k];

                        // debugger;
                        ob.$$_notify_by_proxyChange('delete', k, old_o, preValue);

                        return true;
                    }
                });
            } else if (_.isPlainObject(this.$$value)) {
                this.$$proxy = new Proxy(this.$$value, {
                    set: function (t, k, v, p) {
                        debugger;

                        let preValue = cloneProxyValue(t);
                        let eventName = 'change';
                        let old_o;

                        let parent_ob = t.__us_ob__;
                        //----------------------------
                        if (typeof t[k] === 'undefined') {
                            eventName = 'add';
                        } else {
                            if (isObject(t[k]) && t[k].__us_ob__ != null) {
                                old_o = t[k].__us_ob__;
                            }
                        }
                        //----------------------------
                        let _v = JSONObserver._observe(v, parent_ob, k);
                        t[k] = _v;
                        //----------------------------
                        parent_ob.$$_notify_by_proxyChange(eventName, k, old_o, preValue);

                        return true;
                    },
                    deleteProperty: function (t, k) {
                        debugger;

                        let preValue = cloneProxyValue(t);
                        let parent_ob = t.__us_ob__;
                        let old_o;

                        if (isObject(t[k]) && t[k].__us_ob__ != null) {
                            old_o = t[k].__us_ob__;
                        }
                        //----------------------------
                        delete t[k];

                        parent_ob.$$_notify_by_proxyChange('delete', k, old_o, preValue);

                        return true;
                    }
                });
                // console.dir(this.$$proxy);
            }
        };


    }).call(JSONObserver.prototype);

    /*========================================================================*/
    (function () {

        // 數據是用 [].method 運作時
        // preValue: []改變前的數值
        // removeKeyList: 曾被數據移除的 key
        this.$$_notify_by_arrayMethod = function (method, preValue, removeKeyList, add, remove) {
            debugger;

            // reset
            this.$$arrayMethod = null;

            this.$$prev_value = cloneProxyValue(preValue);

            // 理論上不要這步驟
            // 但保險用
            removeKeyList.forEach(function (key) {
                let value = preValue[key];
                if (isObject(value) && value.__us_ob__ != null) {
                    let ob = value.__us_ob__;

                    ob.$$removeParent(this, key);
                }
            }, this);

            // 紀錄改變前的數據

            this.$$_notifyListener(method);

        };
        //======================================================================
        // call by item
        this.$$_notify_by_proxyChange = function (event, key, del_ob, preValue) {
            // debugger;

            if (key != null) {
                // 紀錄有哪些 key 改變
                this.$$_addChangeKey(key);
            }

            if (del_ob instanceof JSONObserver) {
                del_ob.$$removeParent(this, key);
            }
            //----------------------------
            if (this.$$arrayMethod) {
                // 若 arry.method 有運作的話
                // 停止下列
                // 避免提交重複訊息
                return;
            }

            // 紀錄改變前的數據
            this.$$prev_value = preValue;


            this.$$_notifyListener(event);
        };
        //======================================================================
        // 應付 [].length 的改變
        // add | remove
        this.$$_notify_by_lengthChange = function (parentValue, prevLength, newLength, preValue) {
            // debugger;

            if (this.$$arrayMethod) {
                // 若 arry.method 有運作的話停止下列
                // 避免提交重複訊息
                return;
            }
            //----------------------------
            // 紀錄改變前的數據
            this.$$prev_value = preValue;

            prevLength = Number(prevLength);
            newLength = Number(newLength);

            let eventName = '';


            if (newLength === prevLength) {
                // no change
                return;
            }

            let start;
            let end;


            if (newLength > prevLength) {
                eventName = "add";

                for (let i = prevLength; i < newLength; i++) {
                    this.$$_addChangeKey(i);
                }

                this.$$_notifyListener(eventName);
            } else {
                // remove

                eventName = 'delete';
                start = newLength;
                end = prevLength;

                for (let i = start; i < end; i++) {
                    // debugger;
                    let value = parentValue[i];
                    // 被刪除的 key
                    this.$$_addChangeKey(i);

                    if (isObject(value) && value.__us_ob__ != null) {
                        let child_ob = value.__us_ob__;
                        child_ob.$$removeParent(this, i);
                    }
                }
                this.$$_notifyListener(eventName);
            }
        };
    }).call(JSONObserver.prototype);
    ////////////////////////////////////////////////////////////////////////////
    (function () {

        // 形成樹狀結構必要的步驟
        this.$$addParent = function (parent, key) {

            key = String(key);

            if (parent.$$cid == this.$$cid) {
                // 自己不能指派為自己的子孫
                // 會造成無窮回圈
                throw new Error('.......');
            }

            if (parent instanceof JSONObserver) {
                // 自己不能在 parent 鏈中
                // 會變死循環
                parent.$$_check_1(this);
            }
            //----------------------------
            // 紀錄被 parent 引用
            let keySet = new Set();

            if (this.$$parentsMap.has(parent)) {
                keySet = this.$$parentsMap.get(parent);
            }
            keySet.add(key);

            this.$$parentsMap.set(parent, keySet);

        };

        //======================================================================
        // 當數據從某個數據移除時
        // 背後的 ob 也必須斷除彼此間的父子關係
        this.$$removeParent = function (parent, key) {
            key = String(key);

            // debugger;
            let p_ob;
            let p_value;

            if (parent instanceof JSONObserver) {
                p_ob = parent;
                p_value = parent.$$value;
            } else if (typeof parent.__us_ob__ !== 'undefined') {
                p_ob = parent.__us_ob__;
                p_value = parent;
            }
            //----------------------------
            if (!this.$$parentsMap.has(p_ob)) {
                return;
            }

            let keySet = this.$$parentsMap.get(p_ob);
            keySet.delete(key);

            if (keySet.size <= 0) {
                // 若與父親都沒關係了
                this.$$parentsMap.delete(p_ob);
            }

        };
        //==================================================================
        // pathList: []
        this.$$_addPath = function (pathList, coordinator) {
            // fix here
            let coordinator_id = coordinator.$$cid;

            // 標記這 path 應該要交由那個 coordinator 處理
            pathList.push(coordinator_id);

            pathList = pathList.reverse();

            let key = pathList.join(".");

            this.$$coordinatorMap[coordinator_id] = coordinator;

            this.$$pathList[key] = pathList;
        }
        //==================================================================
        // 會遞迴往上檢查
        this.$$_check_1 = function (target) {
            // debugger;

            for (let [p, keySet] of this.$$parentsMap) {
                // let p = this.$$parentsMap[id];

                if (p instanceof JSONObserver) {
                    if (p.$$cid == target.$$cid) {
                        throw new Error('you cant be your father');
                    }

                    p.$$_check_1(target);
                }
            }
        };
        //======================================================================
        this.$$_addChangeKey = function (key) {
            this.$$changeKeys.add(key);
        };
        //======================================================================
        // 提醒所屬的 Coordinator
        // 檢查資料的變動
        // 然後叫所屬的 controller 自己去判斷是否要 render
        this.$$_notifyListener = function (eventName) {
            debugger;

            // 找到變動者自己在樹據樹中的位置
            this.$$_findPath();
            //----------------------------
            // $$changeKeys
            // 紀錄變動者有哪些項目變動
            let changeKeys = Array.from(this.$$changeKeys);

            //----------------------------
            // 後面都需要修改
            // pathList
            let _pathList = Object.values(this.$$pathList);

            //----------------------------
            let coordinatorMap = new Map();

            console.log("changeKeys(%s)", JSON.stringify(changeKeys));

            if (changeKeys.length) {
                // 回圈所有紀錄的路徑
                for (let i = 0; i < _pathList.length; i++) {
                    let path = _pathList[i];

                    // 取得路徑所屬的協調者
                    let coordinator_id = path[0];
                    let coordinator = this.$$coordinatorMap[coordinator_id];

                    if (coordinator == null) {
                        throw new Error("no find coordinator");
                    }

                    let pathKeyList = [];

                    if (coordinatorMap.has(coordinator)) {
                        pathKeyList = coordinatorMap.get(coordinator);
                    }

                    for (let j = 0; j < changeKeys.length; j++) {
                        let key = changeKeys[j];
                        let pathKey = path.slice();
                        pathKey.push(key);

                        pathKeyList.push(pathKey);
                    }

                    coordinatorMap.set(coordinator, pathKeyList);
                }
            } else {
                throw new Error("no change key?");
                pathKeyList = _pathList;
            }

            //----------------------------
            // 呼叫協調者
            coordinatorMap.forEach(function (pList, coordinator) {
                coordinator.$$notify(eventName, pList);
            });
        };
        //======================================================================

        // 每次數據變動後，要清理一些記錄
        this.$$_reset = function () {
            this.$$changeKeys.clear();
            this.$$coordinatorMap = {};
            this.$$pathList = {};
        };
        //======================================================================
        this.$$addCoordinator = function (watchOptions) {
            let error;
            if (this.$$coordinator != null) {
                error = "data(" + JSON.stringify(this.$$value) + ") has set Coordinator";
                throw new Error(error);
            } else {
                this.$$coordinator = new Coordinator(this, watchOptions);
            }
        };
        //======================================================================
        // 核心
        //
        // target => 數據變動的節點(最底部)
        this.$$_findPath = function (target, pathList) {
            debugger;

            let self_cid = this.$$cid;

            target = target || this;
            pathList = pathList || [];
            //----------------------------

            if (typeof this.$$coordinator != "undefined") {
                // 重要步驟
                // 碰到一個重要節點
                // 紀錄路徑資訊

                let coordinator = this.$$coordinator;
                let _pathList = pathList.slice();

                target.$$_addPath(_pathList, coordinator);
            }
            //----------------------------

            for (let [p, keySet] of this.$$parentsMap) {

                // let p = this.$$parentsMap[$cid];

                // 取得 parent.path
                // 用遞回，層層向上
                // let parentPath = p.$$_findPath(target);
                //----------------------------

                if (Array.isArray(p.$$value)) {
                    // array
                    for (let i = 0; i < p.$$value.length; i++) {
                        let c_value = p.$$value[i];

                        if (typeof c_value.__us_ob__ !== 'undefined') {
                            if (c_value.__us_ob__.$$cid === self_cid) {

                                // 拷貝
                                let _pathList = pathList.slice();
                                _pathList.push(i);

                                //
                                p.$$_findPath(target, _pathList);
                            }
                        }
                    }
                } else if (_.isPlainObject(p.$$value)) {
                    // {}
                    for (let k in p.$$value) {
                        let c_value = p.$$value[k];

                        if (typeof c_value.__us_ob__ !== 'undefined') {
                            if (c_value.__us_ob__.$$cid === self_cid) {

                                // 拷貝
                                let _pathList = pathList.slice();
                                _pathList.push(k);

                                //
                                p.$$_findPath(target, _pathList);
                            }
                        }
                    }
                }
            }
            //----------------------------
        };

    }).call(JSONObserver.prototype);
})();

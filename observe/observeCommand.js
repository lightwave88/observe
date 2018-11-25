!(function () {
    let _ = require("underscore");
    require("underscore_extension")(_);

    const makeObserver = require("./makeObserver.js");
    

    module.exports = observeCommand; 

    ////////////////////////////////////////////////////////////////////////
    //
    // 對外的 API
    //
    ////////////////////////////////////////////////////////////////////////
    // wrap => 是否要將數據包起來
    // 形成一個簡易使用的 api 介面
    // data => 要設置監控的數據
    // options => watchoptions
    function observeCommand(data, options) {
        // debugger;

        options = options || {};

        let wrap = (options.wrap ? true : false);
        let watchOptions = options.watch;
        
        //----------------------------
        let coordinator
        let ob;

        // debugger;
        // 包含觀察者的數據
        let reativeData = makeObserver(data);

        // debugger;

        // 讓 root 觀察者與協調者橋接
        ob = reativeData.__us_ob__;
        ob.$$addCoordinator(watchOptions);
        //----------------------------
        if (wrap) {
            return ob.$$coordinator;
        }

        return reativeData;
    }
})();
Strophe.addConnectionPlugin("rebind", {
    /**
     * Field: hasRebindFeature
     *
     * After connection attempt it shows if server support rebind feature
     */
    hasRebindFeature: false,

    /**
     * Field: active
     *
     * Shows if rebind is enabled on this session
     */
    active: false,

    /** Function: rebind
     * Restore previous session on server
     *
     * This call will estabilish connection to server and will try to restore previous session on server. If session
     * restoration will not success (because session expired or server don't offer that functionality) connection status
     * will change to CONNFAIL.
     *
     * @param jid  Full JID of session to restore, it can be found as `connection.jid`
     * @param sid  Stream ID of previous session, it can be found as `connection.rebind.sid`
     * @param callback  Callback function that will be called on connection status change
     */
    rebind: function(jid, sid, callback) {
        this._rebind(jid, null, sid, callback, true);
    },

    /** Function: rebindOrConnect
     * Restore previous session on server or create new session if restoration is not possible
     *
     * This call will estabilish connection to server and will try to restore previous session on server. If session
     * restoration will not success (because session expired or server don't offer that functionality) new session will
     * be created.
     *
     * @param jid  Full JID of session to restore, it can be found as `connection.jid`
     * @param pass  Password that should be used to connect to server
     * @param sid  Stream ID of previous session, it can be found as `connection.rebind.sid`
     * @param callback  Callback function that will be called on connection status change
     */
    rebindOrConnect: function(jid, pass, sid, callback) {
        this._rebind(jid, pass, sid, callback, false);
    },

    _handleStreamStart: function(elem) {
        this._conn.rebind.sid = elem.getAttribute("id");
        return Strophe.Websocket.prototype._handleStreamStart.call(this, elem);
    },

    _connect_cb: function(req, cb, raw) {
        this.rebind.hasRebindFeature = this.rebind.hasRebindFeature || req.getElementsByTagNameNS &&
                                       req.getElementsByTagNameNS("p1:rebind", "rebind").length > 0;
        return Strophe.Connection.prototype._connect_cb.apply(this, arguments);
    },

    _authenticate: function(mechanisms) {
        if (!this.hasRebindFeature) {
            if (this._onlyRebind)
                this._conn._changeConnectStatus(Strophe.Status.CONNFAIL, "Rebind not available");
            else
                this._origAuthenticate.call(this._conn, mechanisms);
            return;
        }
        var shandler = this._conn._addSysHandler((function(elem) {
            this._conn.deleteHandler(fhandler);

            this.sid = this._sid;
            this.active = true;
            this._conn.authenticated = true;
            this._conn._changeConnectStatus(Strophe.Status.ATTACHED, null);
            return false;
        }).bind(this), null, "rebind", null, null);

        var fhandler = this._conn._addSysHandler((function(elem) {
            this._conn.deleteHandler(shandler);

            if (this._onlyRebind)
                this._conn._changeConnectStatus(Strophe.Status.CONNFAIL, "Rebind failure");
            else
                this._origAuthenticate.call(this._conn, mechanisms);
            return false;
        }).bind(this), null, "failure", null, null);

        this._conn.send($build('rebind', {
            xmlns: "p1:rebind"
        }).c("jid", {}).t(this._conn.jid)
                            .up()
                            .c("sid", {}).t(this._sid).tree());
    },

    _rebind: function(jid, pass, sid, callback, onlyRebind) {
        this._sid = sid;
        this._onlyRebind = onlyRebind;
        if (sid) {
            if (!this._origAuthenticate) {
                this._origAuthenticate = this._conn.authenticate;
                this._conn.authenticate = this._authenticate.bind(this);
            }
        } else if (onlyRebind) {
            this._conn._changeConnectStatus(Strophe.Status.CONNFAIL, "Rebind not active");
            return;
        }

        this._conn.connect(jid, pass, callback);
    },

    statusChanged: function(status, condition) {
        var _this = this;
        if (this.hasRebindFeature && status == Strophe.Status.CONNECTED) {
            var push = $iq({type: "set"}).c("push", {xmlns: "p1:push"})
                .c("keepalive", {max: "30"}).up()
                .c("session", {duration: "1"});
            this._conn.sendIQ(push, function() {
                _this.active = true;
            }, function() {
                _this.active = false;
            });
        }
    },

    init: function(conn) {
        this._conn = conn;
        this._conn._proto._handleStreamStart = this._handleStreamStart;
        this._conn._connect_cb = this._connect_cb;
    },
});

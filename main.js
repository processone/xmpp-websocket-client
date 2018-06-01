var connection = null;
var con;
var startTime = (new Date()).getTime();

function xmlescape(text)
{
    text = text.toString();
    text = text.replace(/\&/g, "&amp;");
    text = text.replace(/</g, "&lt;");
    text = text.replace(/>/g, "&gt;");
    return text;
}

function addToLog(type, msg)
{
    var d = (new Date()).getTime() - startTime;
    $("#log").append("<div class='" + type + "'>" + (d / 1000).toFixed(2) + " " + xmlescape(msg) + "</div>");
    $("#log").scrollTop(1000000);
}

function onConnect(status)
{
    if (status == Strophe.Status.CONNFAIL) {
        addToLog("msg", "Connection error");
        enableLogin();
    } else if (status == Strophe.Status.DISCONNECTED) {
        addToLog("msg", "Disconnected");
        enableLogin();
    } else if (status == Strophe.Status.REBINDFAILED) {
        addToLog("msg", "Rebind failed");
        enableLogin();
    } else if (status == Strophe.Status.CONNECTED || status == Strophe.Status.ATTACHED) {
        con.send($iq({type: "set"}).c("enable", {xmlns: "urn:xmpp:carbons:1"}));
        addToLog("msg", "Connected");
        enableRoster();
        if ($("#priority").val() == "on")
            con.send($pres().c("priority").t("1"));
        else
            con.send($pres());
        con.sendIQ($iq({type: "get"}).c("query", {xmlns: Strophe.NS.ROSTER}).tree(), onRoster);
    }
}

function onRoster(stanza) {
    $(stanza).find("item").each(function() {
        $("#roster-content").append(
            "<div>" + Strophe.xmlescape($(this).text() + " - " + $(this).attr("jid")) + "</div>");
    });
}

function enableLogin() {
    $("#roster").hide();
    $("#login-box").show();
    $("#connect").removeAttr("disabled");
    $("#disconnect").removeAttr("disabled");
}

function enableRoster() {
    $("#roster").show();
    $("#login-box").hide();
    $("#connect").removeAttr("disabled");
    $("#disconnect").removeAttr("disabled");
    $("#roster-content > *").remove();
}

function freeze() {
    if (con.service.startsWith("ws://")) {
        if (con.save)
            con.save();
        return [con.jid, con.rebind.sid];
    } else if (con) {
        con.pause();
        return [con.jid, con.sid, con.rid, con.wait, con.hold, con.window, con.maxPause];
    }
}
$(window).bind("beforeunload", function() {
    if (con && con.connected)
        $.jStorage.set("sData", freeze());
});

if (!window.console) {
    window.console = {};
    console.log = console.info = console.error = function(msg) { addToLog("msg", msg) };
}

function createConnection() {
    var url = $("#connection_url").val();
        con = new Strophe.Connection(url);
    if (0) {
        con.rawInput = function(str) { addToLog("input", str) };
        con.rawOutput = function(str) { addToLog("output", str) };
    } else {
        con.xmlInput = function(el) { addToLog("input", Strophe.serialize(el)) };
        con.xmlOutput = function(el) { addToLog("output", Strophe.serialize(el)) };
    }
}

function rebindOrConnect(url, jid, pass, sid, callback, onlyRebind) {
    createConnection();

    con.rebind._rebind(jid, pass, sid, callback, onlyRebind);
}

var con;
$(document).ready(function() {
try{
    if (!$("#connection_url").val())
        $("#connection_url").val("ws://" + (document.location.hostname || "localhost") + ":5280/xmpp");
    enableLogin();


    $("#xmlinputsend").bind("click", function() {
        con.send(Strophe.xmlHtmlNode($("#xmlinput").val()).firstElementChild);
        $("#xmlinput").val("");
    })
    Strophe.log = function(level, str) { addToLog("log", str); };

    $("#connect").bind("click", function() {
        createConnection();
        $("#connect").attr("disabled", "true");
        rebindOrConnect($("#connection_url").val(), $("#jid").val(), $("#pass").val(), null, onConnect)
        //con.connect($("#jid").val(), $("#pass").val(), onConnect);
    });
    $("#freeze").bind("click", function() {
        var data = freeze();
        $.jStorage.set("sData", data);
        addToLog("msg", data);
        con._proto.socket.close();
    });
    $("#duprid").bind("click", function() {
        con.send("", 1);
    });
    $("#disconnect").bind("click", function() {
        $("#disconnect").attr("disabled", "true");
        con.disconnect();
    });
    var sData = $.jStorage.get("sData");
    console.info("Sdata", sData);
    if (sData && sData[1]) {
        //createConnection();
        try {
            if ($("#connection_url").val().startsWith("ws:")) {
                rebindOrConnect($("#connection_url").val(), sData[0], "", sData[1], onConnect, true);
                //con.rebind(sData[0], sData[1], onConnect);
            } else {
                createConnection();
                con.attach(sData[0], sData[1], sData[2]);
                con._onIdle();
                enableRoster();
            }
        }
        catch (ex) {
            console.info(ex);
        }
        $.jStorage.deleteKey("sData");
    }
    }catch(ex){alert(ex)}
});


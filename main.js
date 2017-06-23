var connection = null;
var con;
var startTime = (new Date()).getTime();

function xmlescape(text)
    {
        text = text.toString();
        text = text.replace(/\&/g, "&amp;");
        text = text.replace(/</g,  "&lt;");
        text = text.replace(/>/g,  "&gt;");
        return text;
    }

function addToLog(type, msg)
{
    var d = (new Date()).getTime() - startTime;
    $("#log").append("<div class='"+type+"'>"+(d/1000).toFixed(2)+" "+xmlescape(msg)+"</div>");
    $("#log").scrollTop(1000000);
}

function onConnect(c, status)
{
    if (!status)
        status = c;
    var statusMsg = "";
    for (i in Strophe.Status)
        if (Strophe.Status[i] == status)
            statusMsg = i;

    console.info("onConnect", status, statusMsg);

    if (!con)
    if (0) {
        c.rawInput = function(str) { addToLog("input", str) };
        c.rawOutput = function(str) { addToLog("output", str) };
    } else {
        c.xmlInput = function(el) { if(el.nodeType!=3)return; var d; try {d=Strophe.serialize(el)}catch(e){d=el}; addToLog("input", d) };
        c.xmlOutput = function(el) { if(el.nodeType!=3)return; var d; try {d=Strophe.serialize(el)}catch(e){d=el}; addToLog("output", d)};
    }
    //con = c;
    if (status == Strophe.Status.CONNFAIL || status == Strophe.Status.AUTHFAIL) {
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
        $("#roster-content").append("<div>"+Strophe.xmlescape($(this).text()+" - "+$(this).attr("jid"))+"</div>");
    })
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
    return con.freeze();
}
$(window).bind("beforeunload", function() {
    if (con && con.connected)
        $.jStorage.set("sData", [$("#connection_url").val(), freeze()]);
});

if (!window.console) {
    window.console = {}
    console.log = console.info = console.error = function(msg) { addToLog("msg", msg) };
}

function createConnection() {
    var url = $("#connection_url").val();
    if (url.indexOf("ws://") == 0 || url.indexOf("wss://") == 0)
        con = new Strophe.WebSocket(url);
    else
        con = new Strophe.Connection(url);
    if (0) {
        con.rawInput = function(str) { addToLog("input", str) };
        con.rawOutput = function(str) { addToLog("output", str) };
    } else {
        con.xmlInput = function(el) { addToLog("input", Strophe.serialize(el)) };
        con.xmlOutput = function(el) { addToLog("output", Strophe.serialize(el)) };
    }
}

function attach(data) {
    addToLog("msg", "Prebind succeeded. Attaching...");

    var $body = $(data.documentElement);
    con.attach($body.attr("jid"),
               $body.attr("sid"),
               $body.attr("rid"),
               onConnect,
               60, 1);
}

var con;
$(document).ready(function() {
try{
    if (!$("#connection_url").val())
        $("#connection_url").val("ws://"+document.location.host+":5280/xmpp")
        //$("#connection_url").val("http://"+document.location.host+":5280/http-bind")
    enableLogin();

    Strophe.log = function(level, str) { addToLog("log", str) };

    $("#xmlinputsend").bind("click", function() {
        con.send(Strophe.xmlHtmlNode($("#xmlinput").val()).firstElementChild);
        $("#xmlinput").val("");
    })

    $("#connect").bind("click", function() {
        createConnection();
        $("#connect").attr("disabled", "true");
        con.connect($("#jid").val(), $("#pass").val(), onConnect);
        if(0)Strophe.makeConnection("http://"+document.location.host+":5280/http-bind",
                               "ws://"+document.location.host+":5280/xmpp",
                               $("#jid").val(), $("#pass").val(), onConnect)
    });
    $("#prealloc").bind("click", function() {
    jQuery.support.cors=true;
    addToLog("msg", "prealloc start");
        createConnection();
        $.ajax({
            type: 'POST',
            crossDomain: true,
            url: "https://a."+document.location.host+":5281/preallocate",
            headers: {Zuma: "100"},
            xhrFields: {withCredentials: true},
            contentType: 'text/xml',
            processData: false,
            data: $build('body', {
                jid: $("#jid").val(),
                pass: $("#pass").val(),
                rid: '' + Math.floor(Math.random() * 4294967295),
                wait: '60',
                hold: '1'}).toString(),
            dataType: 'xml',
            success: attach,
            error: function(e,f,g){window.er=e;addToLog("msg", ""+e+","+f+","+g)}
        });
        $("#connect").attr("disabled", "true");
    });
    $("#freeze").bind("click", function() {
      var data = freeze();
      $.jStorage.set("sData", [$("#connection_url").val(), freeze()]);
      addToLog("msg", data);
    });
    $("#duprid").bind("click", function() {
      con.send("", 1);
    });
    $("#disconnect").bind("click", function() {
        $("#disconnect").attr("disabled", "true");
        con.disconnect();
    });
    var sData = $.jStorage.get("sData");
    if (sData) {
        $("#connection_url").val(sData[0]);
        createConnection();
        con.thaw(sData[1], onConnect);
        Strophe.makeConnection("http://"+document.location.host+":5280/http-bind",
                               "ws://"+document.location.host+":5280/xmpp",
                               $("#jid").val(), $("#pass").val(), onConnect, sData[1]);
        $.jStorage.deleteKey("sData");
    }
    }catch(ex){alert(ex)}
});


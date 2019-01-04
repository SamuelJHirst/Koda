var express = require("express"),
    session = require("express-session"),
    bodyParser = require("body-parser"),
    cookieParser = require("cookie-parser"),
    swig = require("swig"),
    app = express(),
    config = require("./config"),
    fs = require("fs"),
    columnify = require("columnify"),
    shuffle = require("shuffle-array"),
    cron = require("node-cron"),
    Discord = require("discord.js"),
    client = new Discord.Client();

app.engine("html", swig.renderFile);
app.set("view engine", "html");
app.set("views", __dirname + "/views");
app.use(express.static(__dirname + "/static"));
app.use(cookieParser());
app.use(session({secret: "anything", resave: false, saveUninitialized: false}));
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({extended: true}));
app.set("view cache", false);
swig.setDefaults({cache: false});

var settings = {},
    disallowed = [];

setInterval(function() {
    settings = JSON.parse(fs.readFileSync("./settings.json", "utf8"));
    disallowed = [settings.prefix + "help", settings.prefix + "prefix", settings.prefix + "8ball", settings.prefix + "roulette", settings.prefix + "love", settings.prefix + "pyramid", settings.prefix + "access", settings.prefix + "toggle", settings.prefix + "commands", settings.prefix + "aliases", settings.prefix + "reminders", settings.prefix + "perms"];
}, 1000);

// String Replacements
function stringReplacements(message, response, d) {
    var words = response.split(" "),
        output = response;
    for (var word of words) {
        // Date
        if (word == "DATE()") {
            output = output.replace("DATE()", d.getDate() + "/" + (d.getMonth() + 1) + "/" + d.getFullYear());
        }
        // Time
        if (word == "TIME()") {
            output = output.replace("TIME()", ("0" + d.getHours()).substr(-2, 2) + ":" + ("0" + d.getMinutes()).substr(-2, 2) + ":" + ("0" + d.getSeconds()).substr(-2, 2));
        }
        // User who Triggered Command
        if (word == "USER()") {
            output = output.replace(word, "<@" + message.author.id + ">");
        }
        // Random User 
        if (word == "RANDUSER()") {
            var users = message.guild.members.array();
            output = output.replace(word, users[Math.floor(Math.random() * users.length)].displayName);
        }
        // Random Ping 
        if (word == "RANDPING()") {
            var users = message.guild.members.array();
            output = output.replace(word, "<@" + users[Math.floor(Math.random() * users.length)].id + ">");
        }
        // Random Online Ping
        if (word == "RANDONLINE()") {
            var users = message.guild.members.array().filter(function(x) { return x.presence.status === "online" });
            output = output.replace(word, "<@" + users[Math.floor(Math.random() * users.length)].id + ">");
        }
        // Number of Members
        if (word == "NUMUSERS()") {
            output = output.replace(word, message.guild.memberCount);
        }
        // Random Number
        var r = new RegExp(/\R\A\N\D\N\U\M\((.*?)\)/),
            result = r.exec(word);
        if (result) {
            var values = result[1].split(",");
            console.log(result, values)
            if (!isNaN(parseInt(values[0])) && !isNaN(parseInt(values[1]))) {
                output = output.replace(word, Math.floor(Math.random() * parseInt(values[1])) + parseInt(values[0]));
            }
        }
        // Parameters
        var r = new RegExp(/\P\A\R\A\M\((.*?)\)/),
            result = r.exec(word);

        if (result) {
            if (!isNaN(parseInt(result[1]))) {
                output = output.replace(word, message.content.split(" ")[parseInt(result[1])]);
            }
        }
        return output;
    }
};

// Get User's Permission Levels
function permissions(user) {
    if (settings.permissions[user] === undefined) {
        return 4;
    }
    else {
        return settings.permissions[user];
    }
}

// Handle Messages
client.on("message", function(message) {
    // Ignore Own Messages
    if (message.author.id === config.self.id) {
        return;
    }
    // Help
    if (message.content.startsWith(settings.prefix + "help")) {
        if (settings.help.enabled === true) {
            if (permissions(message.author.id) <= settings.help.access) {
                message.channel.send("Commands and more are available at <https://koda.hirst.xyz>.");
            }
            else {
                message.author.createDM().then(function(channel) {
                    channel.send("You do not have permission to use the " + settings.prefix + "help command.")
                });
            }
        }
        else {
            message.author.createDM().then(function(channel) {
                channel.send("The " + settings.prefix + "help command has been disabled. Please contact the server administrators if you think that this is an error.")
            });
        }
    }
    // Prefix
    if (message.content.startsWith(settings.prefix + "prefix") || message.content.startsWith("!prefix")) {
        if (permissions(message.author.id) <= 1) {
            if (message.content.split(" ")[1].length === 1) {
                settings.prefix = message.content.split(" ")[1];
                fs.writeFile("./settings.json", JSON.stringify(settings, null, 4), "utf8", function() {
                    message.channel.send("The command prefix has been updated.");
                });
            }
            else {
                message.channel.send("You have used invalid syntax. Please refer to the documentation at <https://koda.hirst.xyz>.\n\n`" + message.content.split(" ")[0] + " <new prefix>`");
            }
        }
        else {
            message.author.createDM().then(function(channel) {
                channel.send("You do not have permission to use the " + message.content.split(" ")[0] + " command.")
            });
        }
    }
    // 8Ball
    if (message.content.startsWith(settings.prefix + "8ball")) {
        if (settings.magic_8ball.enabled === true) {
            if (permissions(message.author.id) <= settings.magic_8ball.access) {
                if (message.content.indexOf("?") > -1) {
                    message.channel.send(settings.magic_8ball.responses[Math.floor(Math.random() * settings.magic_8ball.responses.length)]);
                }
                else {
                    message.channel.send("Sorry, I do not understand.");
                }
            }
            else {
                message.author.createDM().then(function(channel) {
                    channel.send("You do not have permission to use the " + settings.prefix + "8ball command.")
                });
            }
        }
        else {
            message.author.createDM().then(function(channel) {
                channel.send("The " + settings.prefix + "8ball command has been disabled. Please contact the server administrators if you think that this is an error.")
            });
        }
    }
    // Roulette
    if (message.content.startsWith(settings.prefix + "roulette")) {
        if (settings.roulette.enabled === true) {
            if (permissions(message.author.id) <= settings.roulette.access) {
                if (Math.random() < settings.roulette.rate) {
                    message.delete();
                    message.channel.send("**BANG!**\n\nYou've been shot.");
                }
                else {
                    message.channel.send("_Silence._\n\nYou live to tell your story.");
                }
            }
            else {
                message.author.createDM().then(function(channel) {
                    channel.send("You do not have permission to use the " + settings.prefix + "roulette command.")
                });
            }
        }
        else {
            message.author.createDM().then(function(channel) {
                channel.send("The " + settings.prefix + "roulette command has been disabled. Please contact the server administrators if you think that this is an error.")
            });
        }
    }
    // Love
    if (message.content.startsWith(settings.prefix + "love")) {
        if (settings.love.enabled === true) {
            if (permissions(message.author.id) <= settings.love.access) {
                if (message.content.split(" ")[1]) {
                    if (message.content.split(" ")[1] == "<@!" + message.author.id + ">") {
                        message.channel.send(settings.love.self);
                    }
                    else if (message.content.split(" ")[1] == "<@" + config.self.id + ">") {
                        message.channel.send(settings.love.bot);
                    }
                    else {
                        message.channel.send("There is " + Math.round(Math.random() * 100) + "% love between <@" + message.author.id + "> and " + message.content.split(" ")[1] + ".");
                    }
                }
                else {
                    message.channel.send("You have used invalid syntax. Please refer to the documentation at <https://koda.hirst.xyz>.\n\n`" + settings.prefix + "love <user>`");
                }
            }
            else {
                message.author.createDM().then(function(channel) {
                    channel.send("You do not have permission to use the " + settings.prefix + "love command.")
                });
            }
        }
        else {
            message.author.createDM().then(function(channel) {
                channel.send("The " + settings.prefix + "love command has been disabled. Please contact the server administrators if you think that this is an error.");
            });
        }
    }
    // Pyramid
    if (message.content.startsWith(settings.prefix + "pyramid")) {
        if (settings.pyramid.enabled === true) {
            if (permissions(message.author.id) <= settings.pyramid.access) {
                if (message.content.split(" ")[1]) {
                        var i = 1,
                        data = [],
                        resp = [];
                    while (i <= settings.pyramid.levels / 2) {
                        var j = 1,
                            k = [];
                        while (j <= i) {
                            k.push(message.content.split(" ")[1]);
                            j++;
                        }
                        data.push(k);
                        i++;
                    }
                    for (var m of data) {
                        resp.push(m.join(" "));
                        resp.push(m.join(" "));
                    }
                    if (settings.pyramid.levels % 2 === 1) {
                        var m = [],
                            n = 1;
                        while (n <= i) {
                            m.push(message.content.split(" ")[1]);
                            n++;
                        }
                        resp.push(m.join(" "));
                    }
                    var arr = shuffle(resp);
                    message.channel.send(arr.join("\n"));
                }
                else {
                    message.channel.send("You have used invalid syntax. Please refer to the documentation at <https://koda.hirst.xyz>.\n\n`" + settings.prefix + "pyramid <emoji>`");
                }
            }
            else {
                message.author.createDM().then(function(channel) {
                    channel.send("You do not have permission to use the " + settings.prefix + "pyramid command.")
                });
            }
        }
        else {
            message.author.createDM().then(function(channel) {
                channel.send("The " + settings.prefix + "pyramid command has been disabled. Please contact the server administrators if you think that this is an error.");
            });
        }
    }
    // Manage Custom Commands
    if (message.content.startsWith(settings.prefix + "commands")) {
        var params = message.content.split(" ");
        if (params[1] == "add") {
            if (permissions(message.author.id) <= 1) {
                if (params[2] && params[3]) {
                    if (disallowed.indexOf(params[2]) === -1) {
                        var exists = false;
                        for (var command of settings.commands) {
                            if (command.name == params[2]) {
                                exists = true;
                            }
                        }
                        if (Object.keys(settings.aliases).indexOf(params[2]) > -1) {
                            exists = true;
                        }
                        if (!exists) {
                            settings.commands.push({
                                name: params[2],
                                response: params.slice(3).join(" "),
                                access: 4,
                                cooldown: 0,
                                last_used: 0
                            });
                            fs.writeFile("./settings.json", JSON.stringify(settings, null, 4), "utf8", function() {
                                message.channel.send("The " + params[2] + " command has been added.");
                            });
                        }
                        else {
                            message.channel.send("The " + params[2] + " command/alias already exists.");
                        }
                    }
                    else {
                        message.channel.send("You cannot use a reserved command name.");
                    }
                }
                else {
                    message.channel.send("You have used invalid syntax. Please refer to the documentation at <https://koda.hirst.xyz>.\n\n`" + settings.prefix + "commands add <command name> <command response>`");
                }
            }
            else {
                message.author.createDM().then(function(channel) {
                    channel.send("You do not have permission to add commands.");
                });
            }
        }
        else if (params[1] == "edit") {
            if (permissions(message.author.id) <= 1) {
                if (params[2] && params[3]) {
                    var found = false;
                    for (var command of settings.commands) {
                        if (command.name == params[2]) {
                            command.response = params.slice(3).join(" ");
                            found = true;
                        }
                    }
                    if (found) {
                        fs.writeFile("./settings.json", JSON.stringify(settings, null, 4), "utf8", function() {
                            message.channel.send("The " + params[2] + " command has been edited.");
                        });    
                    }
                    else {
                        message.channel.send("The " + params[2] + " command does not exist.");
                    }
                }
                else {
                    message.channel.send("You have used invalid syntax. Please refer to the documentation at <https://koda.hirst.xyz>.\n\n`" + settings.prefix + "commands edit <command name> <command response>`");
                }
            }
            else {
                message.author.createDM().then(function(channel) {
                    channel.send("You do not have permission to edit commands.");
                });
            }
        }
        else if (params[1] == "rename") {
            if (permissions(message.author.id) <= 1) {
                if (params[2] && params[3]) {
                    if (disallowed.indexOf(params[3]) === -1) {
                        var found = false,
                            exists = false;
                        for (var command of settings.commands) {
                            if (command.name == params[3]) {
                                exists = true;
                            }
                            if (command.name == params[2]) {
                                command.name = params[3];
                                found = true;
                            }
                        }
                        if (Object.keys(settings.aliases).indexOf(params[3]) > -1) {
                            exists = true;
                        }
                        if (found && !exists) {
                            fs.writeFile("./settings.json", JSON.stringify(settings, null, 4), "utf8", function() {
                                message.channel.send("The " + params[2] + " command has been renamed.");
                            });
                        }
                        else if (!found) {
                            message.channel.send("The " + params[2] + " command does not exist.");
                        }
                        else {
                            message.channel.send("The " + params[3] + " command/alias already exists.");
                        }
                    }
                    else {
                        message.channel.send("You cannot use a reserved command name.");
                    }
                }
                else {
                    message.channel.send("You have used invalid syntax. Please refer to the documentation at <https://koda.hirst.xyz>.\n\n`" + settings.prefix + "commands rename <old command name> <new command name>`");
                }
            }
            else {
                message.author.createDM().then(function(channel) {
                    channel.send("You do not have permission to rename commands.");
                });
            }
        }
        else if (params[1] == "cooldown") {
            if (permissions(message.author.id) <= 1) {
                if (params[2] && params[3] && !isNaN(parseInt(params[3])) && parseInt(params[3]) >= 0) {
                    var found = false;
                    for (var command of settings.commands) {
                        if (command.name == params[2]) {
                            command.cooldown = parseInt(params[3]);
                            found = true;
                        }
                    }
                    if (found) {
                        fs.writeFile("./settings.json", JSON.stringify(settings, null, 4), "utf8", function() {
                            message.channel.send("The " + params[2] + " command cooldown has been updated.");
                        });
                    }
                    else {
                        message.channel.send("The " + params[2] + " command does not exist.");
                    }
                }
                else {
                    message.channel.send("You have used invalid syntax. Please refer to the documentation at <https://koda.hirst.xyz>.\n\n`" + settings.prefix + "commands cooldown <command name> <command cooldown time>`");
                }
            }
            else {
                message.author.createDM().then(function(channel) {
                    channel.send("You do not have permission to update command cooldowns.");
                });
            }
        }
        else if (params[1] == "delete") {
            if (permissions(message.author.id) <= 1) {
                if (params[2]) {
                    var found = false;
                    for (var i in settings.commands) {
                        if (settings.commands[i].name == params[2]) {
                            found = true;
                            for (var alias of Object.keys(settings.aliases)) {
                                if (settings.aliases[alias] == settings.commands[i].name) {
                                    delete settings.aliases[alias];
                                }
                            }
                            settings.commands.splice(i, 1);
                        }
                    }
                    if (found) {
                        fs.writeFile("./settings.json", JSON.stringify(settings, null, 4), "utf8", function() {
                            message.channel.send("The " + params[2] + " command has been deleted.");
                        });
                    }
                    else {
                        message.channel.send("The " + params[2] + " command does not exist.");
                    }
                    
                }
                else {
                    message.channel.send("You have used invalid syntax. Please refer to the documentation at <https://koda.hirst.xyz>.\n\n`" + settings.prefix + "commands delete <command name> <command response>`");
                }
            }
            else {
                message.author.createDM().then(function(channel) {
                    channel.send("You do not have permission to delete commands.");
                });
            }
        }
        else if (params[1] == "list") {
            if (settings.commands[0]) {
                message.channel.send("Custom command list: \n\n```" + columnify(settings.commands, { columns: [ "name", "response" ], columnSplitter: "   "}) + "```");
            }
            else {
                message.channel.send("There are no existing custom commands.");
            }
        }
    }
    // Execute Custom Commands
    for (var command of settings.commands) {
        if (message.content.startsWith(command.name)) {
            var d = new Date();
            if (permissions(message.author.id) <= command.access) {
                if ((command.last_used + command.cooldown) < parseInt(d / 1000)) {
                    message.channel.send(stringReplacements(message, command.response, d));
                    settings.commands[settings.commands.map(function(x) { return x.name; }).indexOf(command.name)].last_used = parseInt(d / 1000);
                    fs.writeFile("./settings.json", JSON.stringify(settings, null, 4), "utf8", function() {});
                }
            }
            else {
                message.author.createDM().then(function(channel) {
                    channel.send("You do not have permission to use the " + message.content.split(" ")[0] + " command.");
                });
            }
        }
    }
    // Manage Custom Aliases
    if (message.content.startsWith(settings.prefix + "aliases")) {
        var params = message.content.split(" ");
        if (params[1] == "add") {
            if (permissions(message.author.id) <= 1) {
                if (params[2] && params[3]) {
                    if (disallowed.indexOf(params[2]) === -1) {
                        var found = false;
                            exists = false;
                        for (var command of settings.commands) {
                            if (command.name == params[3]) {
                                found = true;
                            }
                            if (command.name == params[2]) {
                                exists = true;
                            }
                        }
                        if (Object.keys(settings.aliases).indexOf(params[2]) > -1) {
                            exists = true;
                        }
                        if (found && !exists) {
                            settings.aliases[params[2]] = params[3];
                            fs.writeFile("./settings.json", JSON.stringify(settings, null, 4), "utf8", function() {
                                message.channel.send("The " + params[2] + " alias has been added.");
                            });
                        }
                        else if (!found) {
                            message.channel.send("The " + params[3] + " command does not exist.");
                        }
                        else {
                            message.channel.send("The " + params[2] + " command/alias already exists.");
                        }
                    }
                    else {
                        message.channel.send("You cannot use a reserved command name.");
                    }
                }
                else {
                    message.channel.send("You have used invalid syntax. Please refer to the documentation at <https://koda.hirst.xyz>.\n\n`" + settings.prefix + "aliases add <alias name> <command name>`");
                }
            }
            else {
                message.author.createDM().then(function(channel) {
                    channel.send("You do not have permission to add aliases.");
                });
            }
        }
        else if (params[1] == "delete") {
            if (permissions(message.author.id) <= 1) {
                if (params[2]) {
                    if (settings.aliases[params[2]]) {
                        delete settings.aliases[params[2]];
                        fs.writeFile("./settings.json", JSON.stringify(settings, null, 4), "utf8", function() {
                            message.channel.send("The " + params[2] + " alias has been deleted.");
                        });
                    }
                    else {
                        message.channel.send("The " + params[2] + " alias does not exist.");
                    }
                    
                }
                else {
                    message.channel.send("You have used invalid syntax. Please refer to the documentation at <https://koda.hirst.xyz>.\n\n`" + settings.prefix + "aliases delete <command name> <command response>`");
                }
            }
            else {
                message.author.createDM().then(function(channel) {
                    channel.send("You do not have permission to delete aliases.");
                });
            }
        }
        else if (params[1] == "list") {
            var data = [];
            for (var alias of Object.keys(settings.aliases)) {
                data.push({
                    name: alias,
                    command: settings.aliases[alias]
                });
            }
            if (data[0]) {
                message.channel.send("Alias list: \n\n```" + columnify(data, { columnSplitter: "   "}) + "```");
            }
            else {
                message.channel.send("There are no existing aliases.");
            }
        }
    }
    // Execute Custom Aliases
    for (var alias of Object.keys(settings.aliases)) {
        if (message.content.startsWith(alias)) {
            var d = new Date(),
                command = settings.commands.map(function(x) { return x.name; }).indexOf(settings.aliases[alias]);
            if (permissions(message.author.id) <= settings.commands[command].access) {
                if ((settings.commands[command].last_used + settings.commands[command].cooldown) < parseInt(d / 1000)) {
                    message.channel.send(stringReplacements(message, settings.commands[command].response), d);
                    settings.commands[command].last_used = parseInt(d / 1000);
                    fs.writeFile("./settings.json", JSON.stringify(settings, null, 4), "utf8", function() {});
                }
            }
            else {
                message.author.createDM().then(function(channel) {
                    channel.send("You do not have permission to use the " + message.content.split(" ")[0] + " command.");
                });
            }
        }
    }
    // Manage Reminders
    if (message.content.startsWith(settings.prefix + "reminders")) {
        var params = message.content.split(" ");
        if (params[1] == "add") {
            if (permissions(message.author.id) <= 1) {
                if (params[2] && params[3] && params[4]) {
                    var date = params[2].split("/"),
                        time = params[3].split(":");
                    if (!isNaN(parseInt(date[0])) && !isNaN(parseInt(date[0])) && !isNaN(parseInt(date[1])) && !isNaN(parseInt(date[2])) && !isNaN(parseInt(time[0])) && !isNaN(parseInt(time[1]))) {
                        if (parseInt(date[1]) >= 1 && parseInt(date[1]) <= 12 && parseInt(time[0]) >= 0 && parseInt(time[0]) <= 23 && parseInt(time[1]) >= 0 && parseInt(time[1]) <= 59 && parseInt(date[0]) >= 1 && ((parseInt(date[0]) <= 31 && [1, 3, 5, 7, 8, 10, 12].indexOf(parseInt(date[1])) > -1) || (parseInt(date[0]) <= 30 && [4, 6, 9, 11].indexOf(parseInt(date[1])) > -1) || (parseInt(date[0]) <= 29 && parseInt(date[1]) === 2 && (parseInt(date[2]) % 4) === 0) || (parseInt(date[0]) <= 28 && parseInt(date[1]) === 2))) {
                            var d = new Date(parseInt(date[2]), parseInt(date[1]) - 1, parseInt(date[0]), parseInt(time[0]), parseInt(time[1]));
                            if (d.valueOf() > Date.now()) {
                                settings.reminders.push({
                                    timestamp: (parseInt(d.valueOf()) / 1000),
                                    channel: message.channel.id,
                                    reminder: params.slice(4).join(" "),
                                });
                                fs.writeFile("./settings.json", JSON.stringify(settings, null, 4), "utf8", function() {
                                    var months = ["January", "Febuary", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
                                    message.channel.send("The reminder has been set for " + months[d.getMonth()] + " " + d.getDate() + ", " + d.getFullYear() + " at " + ("0" + d.getHours()).substr(-2, 2) + ":" + ("0" + d.getMinutes()).substr(-2, 2) + ".");
                                });
                            }
                            else {
                                message.channel.send("You have cannot set a reminder in the past.");
                            }
                        }
                        else {
                            message.channel.send("You have used an invalid timestamp.");
                        }
                    }
                    else {
                        message.channel.send("You have used invalid syntax. Please refer to the documentation at <https://koda.hirst.xyz>.\n\n`" + settings.prefix + "reminders add <timestamp> <reminder>`");
                    }
                }
                else {
                    message.channel.send("You have used invalid syntax. Please refer to the documentation at <https://koda.hirst.xyz>.\n\n`" + settings.prefix + "reminders add <timestamp> <reminder>`");
                }
            }
            else {
                message.author.createDM().then(function(channel) {
                    channel.send("You do not have permission to add reminders.");
                });
            }
        }
        else if (params[1] == "delete") {
            if (params[2]) {
                if (!isNaN(parseInt(params[2])) && parseInt(params[2]) > 0 && parseInt(params[2]) <= settings.reminders.length) {
                    settings.reminders.splice(parseInt(params[2]) - 1, 1);
                    fs.writeFile("./settings.json", JSON.stringify(settings, null, 4), "utf8", function() {
                        message.channel.send("The reminder has been deleted.");
                    });
                }
                else {
                    message.channel.send("You have used an invalid reminder ID.");
                }
            }
            else {
                message.channel.send("You have used invalid syntax. Please refer to the documentation at <https://koda.hirst.xyz>.\n\n`" + settings.prefix + "reminders delete <reminder id>`");
             }
        }
        else if (params[1] == "list") {
            var data = [],
                months = ["January", "Febuary", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"],
                i = 0;
            for (var reminder of settings.reminders) {
                i++;
                var d = new Date(reminder.timestamp * 1000);
                data.push({
                    id: i,
                    timestamp: months[d.getMonth()] + " " + d.getDate() + ", " + d.getFullYear() + " at " + ("0" + d.getHours()).substr(-2, 2) + ":" + ("0" + d.getMinutes()).substr(-2, 2),
                    reminder: reminder.reminder
                });
            }
            if (data[0]) {
                message.channel.send("Reminder list: \n\n```" + columnify(data, { columnSplitter: "   "}) + "```");
            }
            else {
                message.channel.send("There are no existing reminders.");
            }
        }
    }
    // Enable/Disable Features
    if (message.content.startsWith(settings.prefix + "toggle")) {
        var params = message.content.split(" ");
        if (permissions(message.author.id) <= 1) {
            if (params[1] == settings.prefix + "help") {
                if (params[2] == "on") {
                    settings.help.enabled = true;
                    fs.writeFile("./settings.json", JSON.stringify(settings, null, 4), "utf8", function() {
                        message.channel.send("The " + settings.prefix + "help command has been enabled.");
                    });
                }
                else if (params[2] == "off") {
                    settings.help.enabled = false;
                    fs.writeFile("./settings.json", JSON.stringify(settings, null, 4), "utf8", function() {
                        message.channel.send("The " + settings.prefix + "help command has been disabled.");
                    });
                }
                else {
                    message.channel.send("You have used invalid syntax. Please refer to the documentation at <https://koda.hirst.xyz>.\n\n`" + settings.prefix + "toggle " + settings.prefix + "help (on|off)`");
                }
            }
            else if (params[1] == settings.prefix + "8ball") {
                if (params[2] == "on") {
                    settings.magic_8ball.enabled = true;
                    fs.writeFile("./settings.json", JSON.stringify(settings, null, 4), "utf8", function() {
                        message.channel.send("The " + settings.prefix + "8ball command has been enabled.");
                    });
                }
                else if (params[2] == "off") {
                    settings.magic_8ball.enabled = false;
                    fs.writeFile("./settings.json", JSON.stringify(settings, null, 4), "utf8", function() {
                        message.channel.send("The " + settings.prefix + "8ball command has been disabled.");
                    });
                }
                else {
                    message.channel.send("You have used invalid syntax. Please refer to the documentation at <https://koda.hirst.xyz>.\n\n`" + settings.prefix + "toggle " + settings.prefix + "8ball (on|off)`");
                }
            }
            else if (params[1] == settings.prefix + "roulette") {
                if (params[2] == "on") {
                    settings.roulette.enabled = true;
                    fs.writeFile("./settings.json", JSON.stringify(settings, null, 4), "utf8", function() {
                        message.channel.send("The " + settings.prefix + "roulette command has been enabled.");
                    });
                }
                else if (params[2] == "off") {
                    settings.roulette.enabled = false;
                    fs.writeFile("./settings.json", JSON.stringify(settings, null, 4), "utf8", function() {
                        message.channel.send("The " + settings.prefix + "roulette command has been disabled.");
                    });
                }
                else {
                    message.channel.send("You have used invalid syntax. Please refer to the documentation at <https://koda.hirst.xyz>.\n\n`" + settings.prefix + "toggle " + settings.prefix + "roulette (on|off)`");
                }
            }
            else if (params[1] == settings.prefix + "love") {
                if (params[2] == "on") {
                    settings.love.enabled = true;
                    fs.writeFile("./settings.json", JSON.stringify(settings, null, 4), "utf8", function() {
                        message.channel.send("The " + settings.prefix + "love command has been enabled.");
                    });
                }
                else if (params[2] == "off") {
                    settings.love.enabled = false;
                    fs.writeFile("./settings.json", JSON.stringify(settings, null, 4), "utf8", function() {
                        message.channel.send("The " + settings.prefix + "love command has been disabled.");
                    });
                }
                else {
                    message.channel.send("You have used invalid syntax. Please refer to the documentation at <https://koda.hirst.xyz>.\n\n`" + settings.prefix + "toggle " + settings.prefix + "love (on|off)`");
                }
            }
            else if (params[1] == settings.prefix + "pyramid") {
                if (params[2] == "on") {
                    settings.pyramid.enabled = true;
                    fs.writeFile("./settings.json", JSON.stringify(settings, null, 4), "utf8", function() {
                        message.channel.send("The " + settings.prefix + "pyramid command has been enabled.");
                    });
                }
                else if (params[2] == "off") {
                    settings.pyramid.enabled = false;
                    fs.writeFile("./settings.json", JSON.stringify(settings, null, 4), "utf8", function() {
                        message.channel.send("The " + settings.prefix + "pyramid command has been disabled.");
                    });
                }
                else {
                    message.channel.send("You have used invalid syntax. Please refer to the documentation at <https://koda.hirst.xyz>.\n\n`" + settings.prefix + "toggle " + settings.prefix + "pyramid (on|off)`");
                }
            }
        }
        else {
            channel.send("You do not have permission to enable or disable features.");
        }
    }
    // Command Permissions
    if (message.content.startsWith(settings.prefix + "access")) {
        var params = message.content.split(" ");
        if (permissions(message.author.id) <= 1) {
            var perms;
            switch (params[2]) {
                case "admin":
                    perms = 1;
                    break;
                case "mod":
                    perms = 2;
                    break;
                case "vip":
                    perms = 3;
                    break;
                case "user":
                    perms = 4;
                    break;
                default:
                    perms = "invalid";
            }
            if (params[1] == settings.prefix + "help") {
                if (perms != "invalid") {
                    settings.help.access = perms;
                    fs.writeFile("./settings.json", JSON.stringify(settings, null, 4), "utf8", function() {
                        message.channel.send("The required permissions for " + settings.prefix + "help have been updated.");
                    });
                }
                else {
                    message.channel.send("You have used invalid syntax. Please refer to the documentation at <https://koda.hirst.xyz>.\n\n`" + settings.prefix + "access " + settings.prefix + "help (user|vip|mod|admin)`");
                }
            }
            else if (params[1] == settings.prefix + "8ball") {
                if (perms != "invalid") {
                    settings.magic_8ball.access = perms;
                    fs.writeFile("./settings.json", JSON.stringify(settings, null, 4), "utf8", function() {
                        message.channel.send("The required permissions for " + settings.prefix + "8ball have been updated.");
                    });
                }
                else {
                    message.channel.send("You have used invalid syntax. Please refer to the documentation at <https://koda.hirst.xyz>.\n\n`" + settings.prefix + "access " + settings.prefix + "8ball (user|vip|mod|admin)`");
                }
            }
            else if (params[1] == settings.prefix + "roulette") {
                if (perms != "invalid") {
                    settings.roulette.access = perms;
                    fs.writeFile("./settings.json", JSON.stringify(settings, null, 4), "utf8", function() {
                        message.channel.send("The required permissions for " + settings.prefix + "roulette have been updated.");
                    });
                }
                else {
                    message.channel.send("You have used invalid syntax. Please refer to the documentation at <https://koda.hirst.xyz>.\n\n`" + settings.prefix + "access " + settings.prefix + "roulette (user|vip|mod|admin)`");
                }
            }
            else if (params[1] == settings.prefix + "love") {
                if (perms != "invalid") {
                    settings.love.access = perms;
                    fs.writeFile("./settings.json", JSON.stringify(settings, null, 4), "utf8", function() {
                        message.channel.send("The required permissions for " + settings.prefix + "love have been updated.");
                    });
                }
                else {
                    message.channel.send("You have used invalid syntax. Please refer to the documentation at <https://koda.hirst.xyz>.\n\n`" + settings.prefix + "access " + settings.prefix + "love (user|vip|mod|admin)`");
                }
            }
            else if (params[1] == settings.prefix + "pyramid") {
                if (perms != "invalid") {
                    settings.pyramid.access = perms;
                    fs.writeFile("./settings.json", JSON.stringify(settings, null, 4), "utf8", function() {
                        message.channel.send("The required permissions for " + settings.prefix + "pyramid have been updated.");
                    });
                }
                else {
                    message.channel.send("You have used invalid syntax. Please refer to the documentation at <https://koda.hirst.xyz>.\n\n`" + settings.prefix + "access " + settings.prefix + "pyramid (user|vip|mod|admin)`");
                }
            }
            else if (params[1]) {
                if (perms != "invalid") {
                    var found = false;
                    for (var command of settings.commands) {
                        if (command.name == params[1]) {
                            command.access = perms;
                            found = true;
                        }
                    }
                    if (found) {
                        fs.writeFile("./settings.json", JSON.stringify(settings, null, 4), "utf8", function() {
                            message.channel.send("The required permissions for " + params[1] + " have been updated.");
                        });
                    }
                    else {
                        message.channel.send("The " + params[1] + " command does not exist.");
                    }
                }
                else {
                    message.channel.send("You have used invalid syntax. Please refer to the documentation at <https://koda.hirst.xyz>.\n\n`" + settings.prefix + "access <custom command> (user|vip|mod|admin)`");
                }
            }
            else {
                message.channel.send("You have used invalid syntax. Please refer to the documentation at <https://koda.hirst.xyz>.");
            }
        }
        else {
            channel.send("You do not have permission to set required permissions.");
        }
    }
    // User Permissions
    if (message.content.startsWith(settings.prefix + "perms")) {
        var params = message.content.split(" "),
            user = params[1].replace("<@", "").replace("!", "").replace(">", ""),
            perms = permissions(message.author.id),
            current = permissions(user);
        if (params[2] === "admin") {
            if (perms === 0) {
                settings.permissions[user] = 1;
                fs.writeFile("./settings.json", JSON.stringify(settings, null, 4), "utf8", function() {
                    message.channel.send("Permissions updated.");
                });
            }
            else {
                message.channel.send("You do not have permission to do that.");
            }
        }
        else if (params[2] === "mod") {
            if (perms <= 1 && perms < current) {
                settings.permissions[user] = 2;
                fs.writeFile("./settings.json", JSON.stringify(settings, null, 4), "utf8", function() {
                    message.channel.send("Permissions updated.");
                });
            }
            else {
                message.channel.send("You do not have permission to do that.");
            }
        }
        else if (params[2] === "vip") {
            if (perms <= 2 && perms < current) {
                settings.permissions[user] = 3;
                fs.writeFile("./settings.json", JSON.stringify(settings, null, 4), "utf8", function() {
                    message.channel.send("Permissions updated.");
                });
            }
            else {
                message.channel.send("You do not have permission to do that.");
            }
        }
        else if (params[2] === "blacklisted") {
            if (perms <= 2 && perms < current) {
                settings.permissions[user] = 5;
                fs.writeFile("./settings.json", JSON.stringify(settings, null, 4), "utf8", function() {
                    message.channel.send("Permissions updated.");
                });
            }
            else {
                message.channel.send("You do not have permission to do that.");
            }
        }
        else if (params[2] == "none") {
            if (perms <= 2 && perms < current) {
                delete settings.permissions[user];
                fs.writeFile("./settings.json", JSON.stringify(settings, null, 4), "utf8", function() {
                    message.channel.send("Permissions updated.");
                });
            }
            else {
                message.channel.send("You do not have permission to do that.");
            }
        }
        else if (!params[2]) {
            var role;
            switch (current) {
                case 0:
                    role = "owner permissions.";
                    break;
                case 1:
                    role = "admin permissions.";
                    break;
                case 2:
                    role = "mod permissions.";
                    break;
                case 3:
                    role = "vip permissions.";
                    break;
                case 4:
                    role = "default permissions.";
                    break;
                case 5:
                    role = "blacklisted status.";
                    break;
            }
            message.channel.send(params[1] + " has " + role);
        }
        else {
            message.channel.send("You have specified an invalid role.");
        }
    }
});

// Execute Reminders
cron.schedule('0 * * * * *', function() {
    var d = new Date();
    if (settings && settings.reminders) {
        for (var reminder of settings.reminders) {
            if (reminder.timestamp == parseInt(d / 1000)) {
                for (var channel of client.channels.array()) {
                    if (channel.id == reminder.channel) {
                        channel.send(reminder.reminder)
                    }
                }
            }
            if (reminder.timestamp <= parseInt(d / 1000)) {
                settings.reminders.splice(settings.reminders.indexOf(reminder), 1);
                fs.writeFile("./settings.json", JSON.stringify(settings, null, 4), "utf8", function() {});
            }
        }
    }
});

client.login(config.auth.token).then(function() {
    console.log("Bot Online");
});

app.get("/", function(req, res) {
    res.render("index", { prefix: settings.prefix });
});

app.get("/config/", function(req, res) {
    res.send(settings);
});

app.get("*", function(req, res, next) {
    res.redirect("/");
});

var server = app.listen(config.dashboard.port, function() {
    console.log("Server Listening on Port " + config.dashboard.port);
});
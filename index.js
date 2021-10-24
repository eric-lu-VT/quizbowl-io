'use strict';

//hashmap clientsf
const clients = {};
const games = {};

const crawler = require('crawler-request');
const express = require('express');
const socketIO = require('socket.io');
const PORT = process.env.PORT || 8000;
const INDEX = '/index.html';
const path = require('path');

// Connect frontend to express
const server = express()
    .use('/', express.static(path.join(__dirname, 'public')))
    .get("/", (req,res)=> res.sendFile(__dirname + "/public/index.html"))
    .listen(PORT, () => console.log(`Listening on ${PORT}`));

// Connect frontend to websocket
const io = socketIO(server);

/**
 * Processes to run when frontend communicates to backend.
 * @listens "connection"
 */
io.on('connection', client => {
    // console.log('Client connected');

    /**
     * Processes to run when "disconnect" is recieved from frontend.
     * @listens "disconnect"
     */
    client.on("disconnect", () => {
        if(games[client.id] !== undefined) {
            delete games[client.id];
        }
    });

    /**
     * Processes to run when "download" is recieved from frontend.
     * @listens "download"
     */
    client.on("download", (result) => {
        const clientId = result.clientId;

        crawl(result.packetURL).then(res => {       
            
            const payLoad = {
                "success": true,
                "containsTossups": !(res.tossups.length === 0),
                "containsBonuses": !(res.bonuses.length === 0)
            }    
            
            games[clientId] = {
                "id": clientId,
                "packet": res,
                "rate": 1,
                "curQuestion": null,
                "score": 0,
            }

            io.to(clientId).emit("download", payLoad); // send to frontend
        });
    });

    /**
     * Processes to run when "reset" is recieved from frontend.
     * @listens "reset"
     */
    client.on("reset", (clientId) => {
        games[clientId] = null;
        io.to(clientId).emit("reset"); // send to frontend
    });

    /**
     * Processes to run when "beginQuestion" is recieved from frontend.
     * @listens "beginQuestion"
     */
    client.on("beginQuestion", (result) => {
        const curPacket = games[result.clientId];
        games[result.clientId].curQuestion = (result.typeQuestion === "tossup" ? 
            curPacket.packet.tossups.shift() : curPacket.packet.bonuses.shift());

        const payLoad = {
            "question": games[result.clientId].curQuestion.question,
            "typeQuestion": "tossup"
        }

        io.to(result.clientId).emit("beginQuestion", payLoad); // send to frontend
    });

    /**
     * Processes to run when "buzz" is recieved from frontend.
     * @listens "buzz"
     */
    client.on("buzz", (result) => {
        const curPacket = games[result.clientId];

        const payLoad = {
            "answer": games[result.clientId].curQuestion.answer,
            "isTossupsEmpty": curPacket.packet.tossups.length === 0, 
            "isBonusesEmpty": curPacket.packet.bonuses.length === 0
        }

        io.to(result.clientId).emit("buzz", payLoad); // send to frontend
    });

    /**
     * Processes to run when "updateScore" is recieved from frontend.
     * @listens "updateScore"
     */
    client.on("updateScore", (result) => {
        games[result.clientId].score += result.amnt;

        const payLoad = {
            "newScore": games[result.clientId].score
        }

        io.to(result.clientId).emit("updateScore", payLoad); // send to frontend
    });
    
});

/**
* Crawls an online PDF of Quiz Bowl questions, parsing out the toss-up and bonuses contents (if able.)
* @async
* @param {String} url - The web url of a packet of questions to be parsed.
* @returns {{tossups: String[], bonuses: String[]}} The parsed conents of the requested packet.
*/
async function crawl(url) {
    
    return new Promise(function(resolve, reject) {
        crawler(url).then(function(response) {
            const packetInfo = {
                "tossups": [],
                "bonuses": []
            }

            var str = response.text.replace(/(\r\n|\n|\r)/gm, "");
            
            // (str); // temp
            // console.log(response.text); // temp
    
            var values1 = str.split(/\s+/);
            var values2 = str.split(/\s+/);
    
            while(values1.length > 0) {
                var s = values1.shift().replace(/[\u200B-\u200D\uFEFF]/g, '');
    
                var esc = false;
                var bypass = !str.toLowerCase().includes("tossups");
                
                try {
                    if(s != undefined && (s.toLowerCase().includes("tossups") || bypass)) {
                        if(s !== "Tossups" && s !== "TOSSUPS") {
                            values1.unshift("1.");
                        }

                        var i = 1;
                        while(values1.length > 0 && i <= 20) {
                            if(i == 1) {
                                s = values1.shift().replace(/[\u200B-\u200D\uFEFF]/g, '');
                            }
                            if(s.includes(i + ".") || s.includes("(" + i + ")")) {
                                var question = "";
                                var answer = "";
                                question += (i + ". ");
                                
                                if(s !== ((i).toString() + ".")) {
                                    s = s.substring(s.indexOf((i).toString() + ".") + 2);
                                }
                                else {
                                    s = values1.shift().replace(/[\u200B-\u200D\uFEFF]/g, '');
                                }
                                while(!(s.toLowerCase().includes("answer"))) {
                                    question += (s + " ");
                                    s = values1.shift().replace(/[\u200B-\u200D\uFEFF]/g, '');
                                }

                                if(s !== "ANSWER:" && s !== "Answer:" && s !== "Answer: " && s !== "Answer: ") {
                                    s = s.substring(s.indexOf(":") + 1);
                                }
                                else {
                                    s = values1.shift().replace(/[\u200B-\u200D\uFEFF]/g, '');
                                }
        
                                while(!s.includes((i+1).toString() + ".") && !s.includes("(" + (i+1).toString() + ")") && !s.toLowerCase().includes("bonuses")) {
                                    answer += (s + " ");
                                    s = values1.shift().replace(/[\u200B-\u200D\uFEFF]/g, '');
                                    if(s.toLowerCase().includes("extra:") || s.toLowerCase().includes("tiebreaker")) {
                                        esc = true;
                                        break;
                                    }
                                }  
                                if((i+1).toString() + "." !== s) {
                                    values1.unshift(s.replace((i+1).toString() + ".", ""));
                                    s = (i+1).toString() + "."
                                }
                                packetInfo.tossups.push({
                                    "question": removeCharacters(question),
                                    "answer": removeCharacters(answer)
                                });
                                i++;
                                if(esc) {
                                    break;
                                }
                            }
                        }
                    
                    }
                }
                catch(TypeError) {
    
                }
                if(esc) {
                    break;
                }
            }
    
            while(values2.length > 0) {
                var s = values2.shift().replace(/[\u200B-\u200D\uFEFF]/g, '');
    
                var esc = false;
                try {
                    if(s != undefined && (s.toLowerCase().includes("bonuses"))) {
                        if(s !== "Bonuses" && s !== "BONUSES") {
                            values2.unshift("1.");
                        }
                        
                        var i = 1;
                        while(values2.length > 0) {
                            if(i == 1) {
                                s = values2.shift().replace(/[\u200B-\u200D\uFEFF]/g, '');
                            }
                            if(s.includes(i + ".") || s.includes("(" + i + ")")) {
                                for(var j = 0; j < 3; j++) {
                                    var question = "";
                                    var answer = "";
                                    if(j === 0) {
                                        question += (i + ". ");
                                    }
                                    s= values2.shift().replace(/[\u200B-\u200D\uFEFF]/g, '');
                                    while(!s.toString().toLowerCase().includes("answer:")) {
                                        question += (s + " ");
                                        s = values2.shift().replace(/[\u200B-\u200D\uFEFF]/g, '');
                                    }

                                    if(s !== "ANSWER:" && s !== "Answer:" && s !== "Answer: " && s !== "Answer: ") {
                                        var idx = s.indexOf(":")
                                        s = s.substring(idx + 1);
                                    }
                                    else {
                                        s = values2.shift().replace(/[\u200B-\u200D\uFEFF]/g, '');
                                    }
                                    while(!s.includes("[10]") && !s.includes((i+1).toString() + ".")) {
                                        answer += (s + " ");
                                        s = values2.shift().replace(/[\u200B-\u200D\uFEFF]/g, '');
                                        if(s.toLowerCase().includes("extra") || s.toLowerCase().includes("tiebreaker") || values2.length === 0) {
                                            esc = true;
                                            break;
                                        }
                                    }

                                    packetInfo.bonuses.push({
                                        "question": removeCharacters(question),
                                        "answer": removeCharacters(answer)
                                    });
                                }
                                i++;
                                // packetInfo.bonuses.push(temp);
                            }
                            else {
                                esc = true;
                            }
                            if(esc) {
                                break;
                            }
                        }
                    }
                    if(esc) {
                        break;
                    }
                }
                catch(TypeError) {
    
                }
            }

            resolve(packetInfo);
        });
    });
}

/**
* Removes unnecessary contents from the contents of a packet question / answer.
* Unnecessary content is: text enclosed by brackets, parentheses, and angle brackets, 
* as well as astericks.
* Other minor text adjustments are also done, if needed. 
* @param {String} str - The string representing a question or answer from a packet.
* @returns {String} A string representing a question or answer from a packet, with all unnecessary content removed.
*/
function removeCharacters(str) {
    while(str.includes("[")) {
        str = str.substring(0, str.indexOf("[") - 1) + str.substring(str.indexOf("]") + 1);
    }
    while(str.includes("(")) {
        str = str.substring(0, str.indexOf("(") - 1) + str.substring(str.indexOf(")") + 1);
    }
    while(str.includes("<")) {
        str = str.substring(0, str.indexOf("<") - 1) + str.substring(str.indexOf(">") + 1);
    }
    if(str.includes("*")) {
        str.replace("*", "");
    }
    if(str.charAt(str.length - 1) === " ") {
        str = str.substring(0, str.length - 1);
    }
    if((str.match(/1./g) || []).length > 1) {
        str = str.substring(3);
        str = str.substring(str.indexOf("1."));
    }

    return str;
}
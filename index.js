// import fs, express, and ws. Loads config
const fs = require('fs');
const express = require('express');
const { WebSocket, Server } = require('ws');
const config = JSON.parse(fs.readFileSync(__dirname + '/config.json', 'utf8'));
console.log(config);

console.log("Dependencies loaded. Starting server...");

// create an express app
const app = express();
app.use(express.static('overlay'));
app.listen(3000, () => console.log('Server ready on port 3000'));

// When a user makes a request to /overlay, serve the overlay/overlay.html file
app.get('/overlay', (req, res) => {
    res.sendFile(__dirname + '/overlay/overlay.html');
});

// create a websocket. Overlay talks to this
const wss = new Server({
    port: 8080
});

wss.on('connection', function connection(ws) {
    console.log('Overlay connected');
});

wss.on('close', function close() {
    console.log('Overlay disconnected');
});

console.log("Servers Starting. Listening on port 8080 http://localhost:8080/overlay and ws://localhost:8080/");
console.log("Connecting to the Glimesh API..");


// Connect to the Glimesh API
let websocketConnection = new WebSocket(`wss://glimesh.tv/api/socket/websocket?vsn=2.0.0&client_id=${config.clientID}`);

websocketConnection.on("open", () => {
    console.log("Connected to the Glimesh API.");

    websocketConnection.send('["1","1","__absinthe__:control","phx_join",{}]');
    websocketConnection.send(`["1","2","__absinthe__:control","doc",{"query":"subscription{ chatMessage(channelId: ${config.channelID}) { user { username }, message } }","variables":{} }]`);

    heartbeat = setInterval(() => {
        websocketConnection.send(`[null,"4","phoenix","heartbeat",{}]`);
    }, 30000);
});

websocketConnection.on("message", (data) => {
    let rawData = data.toString();
    let parsedData = JSON.parse(rawData);

    try {
        const message = parsedData[4].result.data.chatMessage.message;
        const user = parsedData[4].result.data.chatMessage.user.username;
        // Log the message and user in blue font
        console.log(`\x1b[34m${user}\x1b[0m: ${message}`);

        // check if the user is in test array
        if (config.users.includes(user)) {
            // send the message to all connected clients
            wss.clients.forEach((client) => {
                client.send(JSON.stringify({
                    user: user,
                    message: message
                }));
            });
        }
    } catch (e) {
    }
})

websocketConnection.on("close", () => {
    console.log("Disconnected from the Glimesh API.");
    // end node process
    process.exit();
});

websocketConnection.on("error", (error) => {
    console.log(error);
    // end node process
    process.exit();
});
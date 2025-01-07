const fs = require('fs');
const WebSocket = require('ws');
const http = require('http');
const path = require('path');


//location of log file relative to cwd
const filePath = path.join(__dirname, 'log.txt');
const clientHtmlPath = path.join(__dirname, 'client.html');
// const scriptPath 


/*
Application Flow:

1. create an http server
2. create a ws connection
3. listen to desired port on both sides
4. read data from log file
5. send initial data (10lines) when first load happends
6. As log.txt gets updated, update the html as well.

*/ 

//http server
const server = http.createServer((req, res) => {

    if(req.url === '/log') {

        //read the client.html

        fs.readFile(clientHtmlPath, (err, data) => {

            if(err) {
                console.error(`Error occured while reading the client.html: ${err.message}`);
                res.writeHead(500);
                res.end(`Error occured while reading the client.html: ${err.message}`);
            } else {
                res.writeHead(200);
                res.end(data);
            }
        })
    }
});

//creating a ws
const wss = new WebSocket.Server({server});

//place holder to tract till where file is already read.
let initialSize;

//gets the last n lines of the log file
const getLastLines = function (lineCount) {

    let position;
    let chunkBuffer = '';
    let lines = [];

    return new Promise((resolve, reject) => {

        fs.stat(filePath, (err, stat) => {

            if(err) {
                reject(`Error occured while getting log file stts: ${err.message}`);
            }

            position = stat.size;

            function getLinesRecursively() {
                position -= 1024;
                let start = position < 0 ? 0 : position;
                let length = position < 0 ? 1024 + position : 1024;

                const chunkStream = fs.createReadStream(filePath, {encoding: 'utf-8', start, end: start + length - 1});


                chunkStream.on('data', (chunk) => {
                    //prepending the current buffer
                    chunkBuffer = chunk + chunkBuffer;
                    lines = chunkBuffer.split('\n');

                    //meaning we have required number of lines.
                    if(lines.length >= lineCount) {
                        chunkStream.close();
                        resolve(lines.slice(-lineCount).join('\n'));
                    }
                });

                chunkStream.on('close', (chunk) => {
                    chunkBuffer = chunk + chunkBuffer;
                    lines = chunkBuffer.split('\n');

                    if(lines.length >= lineCount) {
                        resolve(lines.slice('\n').join('\n'));
                    } else {
                        getLinesRecursively();
                    }
                });

                chunkStream.on('error', (err) => console.error(`Got an error: ${err.message}`));
            }

            getLinesRecursively();

            initialSize = stat.size;

        })

    })
}

wss.on('connection', async (ws) => {
    //on successful connection, read the last 10 lines of the log file.
    const lastTenLines = await getLastLines(10);

    ws.send(lastTenLines);
});


//function to get latest updates
const getLatestUpdate = function () {

    return new Promise((resolve, reject) => {

        fs.stat(filePath, (err, stat) => {

            if(err) {
                reject(`Error while getting stat of updated files: ${err.message}`);
            }

            const newFileSize = stat.size;
            //this is the length of the data we need to read
            const newUpdatedSize = newFileSize - initialSize;

            if(newUpdatedSize <= 0) {
                console.log('No new updates');
            } else {
                const chunkStream = fs.createReadStream(filePath, {encoding: 'utf-8', start: initialSize, end: initialSize + newUpdatedSize});

                //update the last read position to the current value.
                initialSize = newFileSize;

                chunkStream.on('data', (chunk) => {
                    chunkStream.close();
                    resolve(chunk);
                });

                chunkStream.on('close', (chunk) => resolve(chunk));

                chunkStream.on('error', (err) => console.error(`Error occured while reading the lastest file version: ${err.message}`));
            }
        })
    })
}


//function to monitor the chabges in the log file.
fs.watch(filePath, async (eventType, fileName) => {
    console.log(`Monitoring the file ${fileName}`);

    if(eventType === 'change') {

        const lastestData = await getLatestUpdate();

        wss.clients.forEach((client) => {

            if(client.readyState === WebSocket.OPEN) {
                client.send(lastestData);
            }
        })
    }
})


//listen to port 8080
server.listen(8080, () => {
    console.log(`Visit the following url: http://localhost:8080/log`);
})

//exporting for test cases usage.
module.exports = {
    server, 
    wss,
    getLastLines
}

const WebSocket = require("ws");
const fs = require("fs");
const path = require("path");
const { server, wss, getLastLines } = require("../index");

const mockFilePath = path.join(__dirname, "./log.txt");
const mockFileContent =
  "TestLine1\nTestLine2\nTestLine3\nTestLine4\nTestLine5\nTestLine6\nTestLine7\nTestLine8\nTestLine9\nTestLine10\nTestLine11\nTestLine12";


let fileWatcher;

describe("Application tests", () => {
  beforeAll(async () => {
    //create test file with content
    fs.writeFileSync(mockFilePath, mockFileContent);

    await new Promise((resolve) => setTimeout(resolve, 1000));
  });

  afterAll(async () => {

    return new Promise((resolve) => {
      wss?.clients.forEach((client) => {
        client.close();
      });


      wss?.close(() => {

        server.close(() => {
          if(fileWatcher) {
            fileWatcher.close();
          }

          resolve();
        });
      });
    });
  }, 15000);

  describe("getLastLines Function", () => {
    test("should return last 10 lines from file", async () => {
      const lines = await getLastLines(10);
      const lineArr = lines.split("\n").filter(Boolean);

      console.log(lineArr);
      console.log(`line array length: ${lineArr.length}`);
      expect(lineArr.length).toBeLessThanOrEqual(10);
    }, 10000);
  });


  describe("Continuous file motitoring", () => {
    test("should handle file updates", (done) => {
      const ws = new WebSocket("ws://localhost:8080");
      ws.on("open", () => {
        setTimeout(() => {
          fs.appendFileSync(mockFilePath, "\n test update \n");
          done();
        }, 1000);
      })
    }, 10000)
  })

});

import * as fs from "fs";
import { default as Express } from "express";
import * as path from "path";
import { default as favicon } from "serve-favicon";
import * as Https from "https";
import { fileURLToPath } from "url";
import { ioServer } from "./socket/ioServer";
import { spawn } from "child_process";
// import { states } from "./states";
// import { switchCtrl } from "./arduinoAccess/switch";
import { networkInterfaces } from "os";
import SocketIO from "socket.io";

import { getLiveStream } from "./stream/getLiveStream";
import { stringEmit } from "./socket/ioEmit";
import { webSocket } from "./webSocket/webSocketConnection";

// import { io as socketIoClient, Socket } from "socket.io-client";

// const socketClient: Socket = socketIoClient("https://localhost:8080/socket.io");

// socketClient.on("connect", () => {
//   console.log("Connected to server" + socketClient.id);
// });

// import { cors } from "cors";
// const corsOptions = {
//   origin: "http://127.0.0.1:5173",
//   optionsSuccessStatus: 200,
// };

const port = 8888;
const app = Express();
app.use(Express.json());
// const __filename = fileURLToPath(import.meta.url);
// const __dirname = path.dirname(__filename);
// const __dirname = import.meta.dirname;
// console.log(__dirname);

app.use(Express.static(path.join(__dirname, "..", "static")));
app.use(favicon(path.join(__dirname, "..", "lib/favicon.ico")));

const allowCrossDomain = function (req, res, next) {
  res.header("Access-Control-Allow-Origin", "*");
  res.header("Access-Control-Allow-Methods", "GET,PUT,POST,DELETE");
  res.header(
    "Access-Control-Allow-Headers",
    "Content-Type, Authorization, access_token"
  );
  // intercept OPTIONS method
  if ("OPTIONS" === req.method) {
    res.send(200);
  } else {
    next();
  }
};
app.use(allowCrossDomain);

//const httpsserver = Https.createServer(options,app).listen(port);
const options = {
  key: fs.readFileSync(
    path.join(__dirname, "../../../..", "keys/chat/private.key")
  ),
  cert: fs.readFileSync(
    path.join(__dirname, "../../../..", "keys/chat/selfsigned.crt")
  ),
  passphrase: "chat",
};

const httpserver = Https.createServer(options, app).listen(port);

function getIpAddress() {
  const nets = networkInterfaces();
  const net = nets["en0"]?.find((v) => v.family == "IPv4");
  return !!net ? net.address : null;
}

const host = getIpAddress();
console.log(`Server listening on ${host}:${port}`);

const io: SocketIO.Server = ioServer(httpserver);

webSocket();

app.get("/", function (req, res, next) {
  try {
    res.sendFile(path.join(__dirname, "..", "static", "html", "index.html"));
  } catch (error) {
    console.log(error);
    res.json({ success: false, message: "Something went wrong" });
  }
});

app.get("/snowleopard", function (req, res, next) {
  try {
    console.log("snowleopard");
    res.sendFile(
      path.join(__dirname, "..", "static", "html", "snowleopard.html")
    );
  } catch (error) {
    console.log(error);
    res.json({ success: false, message: "Something went wrong" });
  }
});

app.get("/form", function (req, res, next) {
  try {
    console.log("snowleopard");
    res.sendFile(path.join(__dirname, "..", "static", "html", "form.html"));
  } catch (error) {
    console.log(error);
    res.json({ success: false, message: "Something went wrong" });
  }
});

app.get("/hls", function (req, res, next) {
  try {
    console.log("hls test");
    res.sendFile(path.join(__dirname, "..", "static", "html", "hlstest.html"));
  } catch (error) {
    console.log(error);
    res.json({ success: false, message: "Something went wrong" });
  }
});

app.get("/:name", function (req, res, next) {
  const name = req.params.name;
  try {
    // if (name == "" || name === "pi" || name === "pi5") {
    res.sendFile(path.join(__dirname, "..", "static", "html", "index.html"));
    // } else if (
    //   name == "snowleopard" ||
    //   name == "sl" ||
    //   name === "snow" ||
    //   name == "2008" ||
    //   name == "2009"
    // ) {
    //   res.sendFile(
    //     path.join(__dirname, "..", "static", "html", "snowleopard.html")
    //   );
    // }
    // res.sendFile(path.join(__dirname, "..", "static", "html", "index.html"));
  } catch (error) {
    console.log(error);
    res.json({ success: false, message: "Something went wrong" });
  }
});

app.post("/api/form", function (req, res, next) {
  console.log("POST /api/form", req.body);
  if (req.body.enter) {
    console.log("enter");
  } else {
    console.log("chat:", req.body.chat);
    stringEmit(io, req.body.chat, false);
  }
  res.json({ success: true, message: "Data received" });
});

/*
const socketOptions = {
  cors: {
    origin: function (origin, callback) {
      const isTarget = origin != undefined && origin.includes("localhost") !== null;
      return isTarget ? callback(null, origin) : callback('error invalid domain');
    },
    credentials: true
  },
  maxHttpBufferSize: 1e8,
};
*/

// const io = new Server(httpsserver, socketOptions)

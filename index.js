const app = require("express")();
const http = require("http").Server(app);

const io = require("socket.io")(http, {
  cors: {
    origin: process.env.SOCKET_CLIENT_URL || "http://localhost:4200",
    methods: ["GET", "POST"],
  },
});

const rooms = [];

io.on("connection", (socket) => {
  console.log("client connected");

  socket.on("disconnect", function () {
    const room = rooms.find((r) => r.players.find((p) => p.id == socket.id));
    if (room) {
      const player = room.players.find((p) => p.id == socket.id);
      if (player) room.players = room.players.filter((p) => p.id != socket.id);
      if (!room.players.length) {
        rooms.splice(
          rooms.findIndex((r) => r.code == room.code),
          1
        );
        return;
      }
      io.to(room.code.toString()).emit("poker-room", room);
    }
    console.log("client disconnected");
  });
  onCreateRoom(socket);
  onJoinRoom(socket);
  onJoinGame(socket);
  onPickCard(socket);
  onFlipCard(socket);
  onNewVote(socket);
});

const state = {
  Pending: 1,
  Done: 2,
  Flip: 3,
};

function onCreateRoom(socket) {
  socket.on("create-room", (name) => {
    // Tạo một room
    const code = genRoomCode();
    const room = {
      code,
      name,
      state: null,
      players: [],
    };
    rooms.push(room);
    socket.join(code.toString());
    socket.emit("created-room", room);
  });
}
/**
 * Client join the room
 * @param {*} socket
 */
function onJoinRoom(socket) {
  socket.on("join-room", (code) => {
    const room = rooms.find((room) => room.code == code);
    if (!room) {
      socket.emit("joined-room", {
        isSuccess: false,
        room: null,
        message: "Room not found!",
      });
      return;
    }
    socket.join(code);
    io.to(socket.id).emit("joined-room", {
      isSuccess: true,
      room: room,
      message: `Success joined room with room code: ${code}`,
    });
    io.to(code).emit("poker-room", room);
  });
}

function onJoinGame(socket) {
  socket.on("join-game", ({ code, nickName }) => {
    const room = rooms.find((room) => room.code == code);
    if (!room) return;
    let player = {
      id: socket.id,
      nickName,
      score: 0,
    };
    room.players.push(player);
    room.state = state.Pending;
    console.log(room);
    io.to(socket.id).emit("joined-game", {
      player,
      room,
    });
    console.log(code);
    io.to(code.toString()).emit("poker-room", room);
  });
}

function onPickCard(socket) {
  socket.on("pick-card", ({ id, code, score }) => {
    const room = rooms.find((room) => room.code == code);
    if (!room) return;
    const player = room.players.find((p) => p.id == id);
    if (!player) return;
    player.score = score;
    player.state = state.Done;
    let isAllPlayerDone = room.players.every((p) => p.score != 0);
    room.state = isAllPlayerDone ? state.Done : state.Pending;
    io.to(code.toString()).emit("poker-room", room);
  });
}
function onFlipCard(socket) {
  socket.on("flip-card", (code) => {
    const room = rooms.find((room) => room.code == code);
    if (!room) return;
    room.state = state.Flip;
    io.to(code.toString()).emit("poker-room", room);
  });
}
function onNewVote(socket) {
  socket.on("new-vote", (code) => {
    const room = rooms.find((room) => room.code == code);
    if (!room) return;
    room.state = state.Pending;
    room.players.forEach((p) => {
      p.state = state.Pending;
      p.score = 0;
    });
    io.to(code.toString()).emit("poker-room", room);
  });
}

function genRoomCode() {
  return Math.ceil(Math.random() * 10000);
}

http.listen(5000, () => {
  console.log("started on port 5000");
});

import { io } from "socket.io-client";
const socket = io();
import { cnvs, ctx } from "../globalVariable";
import { textPrint, erasePrint } from "../imageEvent";
const clientMode = "form";
let stringsClient = "";
const formElement = document.getElementById("form");
// formの入力
formElement.addEventListener("input", (e) => {
    const inputElement = e.target;
    const inputValue = inputElement.value;
    console.log("form content: ", inputValue);
    socket.emit("stringFromForm", inputValue);
});
// Shift+Enterで送信
formElement.addEventListener("keydown", (e) => {
    if (e.shiftKey && e.key === "Enter") {
        e.preventDefault();
        const inputElement = e.target;
        const inputValue = inputElement.value;
        socket.emit("enterFromForm", inputValue);
        inputElement.value = ""; // フォームの内容を削除する
    }
});
socket.on("stringsFromServer", (data) => {
    // erasePrint(stx, strCnvs);
    erasePrint(ctx, cnvs);
    console.log("stringsFromServer", data);
    stringsClient = data.strings;
    textPrint(stringsClient, ctx, cnvs);
    if (data.timeout) {
        setTimeout(() => {
            erasePrint(ctx, cnvs);
        }, 500);
    }
});
socket.on("erasePrintFromServer", () => {
    // erasePrint(stx, strCnvs)
    erasePrint(ctx, cnvs);
});

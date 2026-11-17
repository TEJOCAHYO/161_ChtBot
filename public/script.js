const chatForm = document.getElementById("chat-form");
const userInput = document.getElementById("user-input");
const chatBox = document.getElementById("chat-box");

const messages = [];

function addMessage(text, sender) {
    const message = document.createElement("div");
    message.classList.add("message", sender);

    const content = document.createElement("div");
    content.classList.add("message-content");
    content.textContent = text;

    message.appendChild(content);
    chatBox.appendChild(message);
    chatBox.scrollTop = chatBox.scrollHeight;

    return content;
}

chatForm.addEventListener("submit", async (event) => {
    event.preventDefault();

    const message = userInput.value.trim();
    if (!message) {
        return;
    }

    // 1. Tampilkan pesan user ke layar
    addMessage(message, "user");

    // Simpan pesan user ke array
    messages.push({
        role: "user",
        content: message
    });

    // Kosongkan input
    userInput.value = "";

    // Disable input sementara selama bot memproses
    userInput.disabled = true;
    const button = chatForm.querySelector("button");
    button.disabled = true;
    button.textContent = "Menunggu...";

    // 2. Buat bubble AI kosong untuk streaming response
    const botContent = addMessage("", "bot");
    let botResponse = "";

    try {
        const response = await fetch("/api/chat", {
            method: "POST",
            headers: {
                "Content-Type": "application/json"
            },
            body: JSON.stringify({
                messages: messages
            })
        });

        if (!response.ok) {
            const errorData = await response.json();
            throw new Error(errorData.error || "Terjadi kesalahan pada server");
        }

        // =========================
        // Baca streaming response
        // =========================
        const reader = response.body.getReader();
        const decoder = new TextDecoder();
        let buffer = "";

        while (true) {
            const { done, value } = await reader.read();

            if (done) {
                break;
            }

            // Decode data chunk
            buffer += decoder.decode(value, { stream: true });

            // Pisahkan berdasarkan baris baru (newline)
            const lines = buffer.split("\n");

            // Simpan bagian yang belum lengkap kembali ke buffer
            buffer = lines.pop();

            for (const line of lines) {
                const trimmedLine = line.trim();

                if (!trimmedLine || !trimmedLine.startsWith("data:")) {
                    continue;
                }

                const data = trimmedLine.slice(5).trim();

                if (data === "[DONE]") {
                    continue;
                }

                try {
                    const token = JSON.parse(data);

                    // Gabungkan token ke teks balasan bot
                    botResponse += token;

                    // Perbarui tampilan teks di bubble chat secara real-time
                    botContent.textContent = botResponse;

                    // Auto-scroll ke bagian bawah chat box
                    chatBox.scrollTop = chatBox.scrollHeight;

                } catch (error) {
                    console.error("Gagal memparsing token JSON:", error);
                }
            }
        }

        // 3. Simpan respons lengkap AI ke riwayat array
        messages.push({
            role: "assistant",
            content: botResponse
        });

    } catch (error) {
        console.error("Error pada fetch chatbot:", error);
        botContent.textContent = "Maaf, terjadi kesalahan: " + error.message;
    } finally {
        // Aktifkan kembali input dan tombol kirim
        userInput.disabled = false;
        button.disabled = false;
        button.textContent = "Kirim";
        userInput.focus();
    }
});
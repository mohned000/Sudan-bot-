import makeWASocket, { useMultiFileAuthState, DisconnectReason } from "@whiskeysockets/baileys"
import Groq from "groq-sdk"
import qrcode from "qrcode-terminal"

const groq = new Groq({ apiKey: process.env.GROQ_KEY })

const prices = { SAR: 1600, USD: 6000, AED: 1650, EGP: 120 }

async function startBot() {
  const { state, saveCreds } = await useMultiFileAuthState('auth')
  const sock = makeWASocket({ auth: state })

  sock.ev.on('creds.update', saveCreds)

  sock.ev.on('connection.update', (u) => {
    if (u.qr) {
      console.log("=== صور الـ QR ده بواتسابك ===")
      qrcode.generate(u.qr, { small: true })
    }
    if (u.connection === 'open') console.log("✅ البوت اتربط بواتساب!")
  })

  sock.ev.on('messages.upsert', async ({ messages }) => {
    const m = messages[0]
    if (!m.message || m.key.fromMe) return
    const text = m.message.conversation || m.message.extendedTextMessage?.text || ""
    
    try {
      const ai = await groq.chat.completions.create({
        model: "llama-3.3-70b-versatile",
        messages: [
          { role: "system", content: "طلع JSON فقط: {amount, from}. from تكون SAR,USD,AED,EGP. لو ماف مبلغ رجع {amount:0}" },
          { role: "user", content: text }
        ]
      })
      const data = JSON.parse(ai.choices[0].message.content)
      if (data.amount > 0) {
        const total = data.amount * (prices[data.from] || 1600)
        await sock.sendMessage(m.key.remoteJid, { text: `💰 ${data.amount} ${data.from} = ${total.toLocaleString()} جنيه سوداني` })
      }
    } catch(e) {
      await sock.sendMessage(m.key.remoteJid, { text: "مرحبا! رسل مثلا: 1000 ريال" })
    }
  })
}
startBot()
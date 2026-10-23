import makeWASocket, { useMultiFileAuthState } from "@whiskeysockets/baileys"
import Groq from "groq-sdk"

const groq = new Groq({ apiKey: process.env.GROQ_KEY })
const prices = { SAR: 1600, USD: 6000, AED: 1650, EGP: 120, QAR: 1650 }

async function startBot() {
  const { state, saveCreds } = await useMultiFileAuthState('auth')
  const sock = makeWASocket({ 
    auth: state, 
    printQRInTerminal: false,
    browser: ["Sudan Bot", "Chrome", "1.0"]
  })

  sock.ev.on('creds.update', saveCreds)

  const myNumber = "249900007969"

  if (!sock.authState.creds.registered) {
    setTimeout(async () => {
      try {
        let code = await sock.requestPairingCode(myNumber)
        console.log("=========================================")
        console.log(" كود الربط بتاعك هو: " + code)
        console.log(" امشي واتساب > الاجهزة المرتبطة > ربط برقم")
        console.log("=========================================")
      } catch(e) {
        console.log("خطأ: " + e)
      }
    }, 5000)
  }

  sock.ev.on('connection.update', (u) => {
    if (u.connection === 'open') console.log("✅ البوت اتربط بواتساب بنجاح!")
  })

  sock.ev.on('messages.upsert', async ({ messages }) => {
    const m = messages[0]
    if (!m.message || m.key.fromMe) return
    const text = m.message.conversation || m.message.extendedTextMessage?.text || ""
    console.log("رسالة: " + text)
    try {
      const ai = await groq.chat.completions.create({
        model: "llama-3.3-70b-versatile",
        messages: [
          { role: "system", content: "انت محول عملات. طلع JSON فقط {\"amount\": رقم, \"from\": \"SAR|USD|AED|EGP\"} لو مافي عملة {\"amount\":0}" },
          { role: "user", content: text }
        ]
      })
      const jsonStr = ai.choices[0].message.content.match(/\{.*\}/)?.[0] || '{"amount":0}'
      const data = JSON.parse(jsonStr)
      if (data.amount > 0) {
        const rate = prices[data.from] || 1600
        const total = data.amount * rate
        const reply = `💰 *حساب العملة*\n\n${data.amount} ${data.from} = *${total.toLocaleString()} جنيه سوداني*\n\nسعر الصرف: ${rate}`
        await sock.sendMessage(m.key.remoteJid, { text: reply })
      }
    } catch(e) {}
  })
}
startBot()

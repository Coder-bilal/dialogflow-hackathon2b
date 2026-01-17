const {
    GoogleGenerativeAI,
    HarmCategory,
    HarmBlockThreshold,
} = require("@google/generative-ai");
require('dotenv').config();
const express = require('express');
const cors = require('cors');
const nodemailer = require('nodemailer');
const { WebhookClient } = require('dialogflow-fulfillment');
const { createClient } = require('@supabase/supabase-js');

const MODEL_NAME = "gemini-flash-latest";
const API_KEY = process.env.GEMINI_API_KEY;

// ────────────────────────────────────────────────
// Database & Email Configuration
// ────────────────────────────────────────────────
const supabase = (process.env.SUPABASE_URL && process.env.SUPABASE_KEY)
    ? createClient(process.env.SUPABASE_URL, process.env.SUPABASE_KEY)
    : null;

const transporter = nodemailer.createTransport({
    host: 'smtp.gmail.com',
    port: 587,
    secure: false,
    auth: {
        user: "bilal317699@gmail.com",
        pass: "khrc vion ltiv hdvi",
    },
});

// ────────────────────────────────────────────────
// Gemini Configuration (User's Implementation)
// ────────────────────────────────────────────────
async function runChat(queryText) {
    try {
        const genAI = new GoogleGenerativeAI(API_KEY);
        // console.log(genAI)
        const model = genAI.getGenerativeModel({ model: MODEL_NAME });

        const generationConfig = {
            temperature: 1,
            topK: 0,
            topP: 0.95,
            maxOutputTokens: 200,
        };

        const chat = model.startChat({
            generationConfig,
            history: [
            ],
        });

        const result = await chat.sendMessage(queryText);
        const response = result.response;
        return response.text();
    } catch (error) {
        console.error("Gemini Error:", error);
        return "Sorry, I am having trouble connecting to the AI server. Please try again later.";
    }
}

async function sendEmailAsync(to, subject, text) {
    const message = {
        from: '"Digital Welfare Bot" <bilal317699@gmail.com>',
        to,
        subject,
        text,
        html: text.replace(/\n/g, "<br>"),
    };

    try {
        const info = await transporter.sendMail(message);
        console.log(`Email sent to ${to} →`, info.messageId);
    } catch (err) {
        console.error('Failed to send email:', err);
    }
}

// ────────────────────────────────────────────────
// Express App Setup
// ────────────────────────────────────────────────
const webApp = express();
const PORT = process.env.PORT || 6000; // Keeping 6000 as per user's running process

webApp.use(express.urlencoded({
    extended: true
}));
webApp.use(express.json());
webApp.use(cors());

webApp.use((req, res, next) => {
    console.log(`Path ${req.path} with Method ${req.method}`);
    next();
});

webApp.get('/', (req, res) => {
    res.send("Digital Welfare Dialogflow webhook is running");
});

// ────────────────────────────────────────────────
// Webhook Endpoint
// ────────────────────────────────────────────────
webApp.post('/dialogflow', async (req, res) => {

    var id = (res.req.body.session).substr(43);
    console.log(`Session ID: ${id}`);

    const agent = new WebhookClient({
        request: req,
        response: res
    });

    // ── Intent Functions ────────────────────────────

    async function fallback() {
        let action = req.body.queryResult.action;
        let queryText = req.body.queryResult.queryText;

        if (action === 'input.unknown') {
            let result = await runChat(queryText);
            agent.add(result);
            console.log(result)
        } else {
            let result = await runChat(queryText);
            agent.add(result);
            console.log(result)
        }
    }

    function hi(agent) {
        console.log(`intent  =>  hi`);
        agent.add('Hi, I am your virtual assistant, Tell me how can I help you')
    }

    async function registration(agent) {
        const params = agent.parameters || {};
        let fullname = "Student";
        if (params.fullname) {
            if (typeof params.fullname === 'object') {
                fullname = params.fullname.name || params.fullname['given-name'] || params.fullname.displayName || "";
            } else {
                fullname = String(params.fullname);
            }
        }

        const phone = params.phone || "N/A";
        const email = params.email || "";
        const cnic = params.cnic || "N/A";
        const course = params.course || "selected course";

        const responseText =
            `Dear ${fullname},\n\n` +
            `Congratulations! 🎉\n` +
            `Your registration for **${course}** has been successfully received.\n\n` +
            `**Details Recorded:**\n` +
            `• Contact: ${phone}\n` +
            `• CNIC: ${cnic}\n\n` +
            `Our team will contact you within 24-48 hours. InshaAllah, this is the start of your success story! 🚀`;

        (async () => {
            await sendEmailAsync(
                "bilal317693@gmail.com",
                "New Registration",
                `Name: ${fullname}\nCourse: ${course}\nPhone: ${phone}\nCNIC: ${cnic}\nEmail: ${email}`
            );

            if (email && email.includes("@")) {
                await sendEmailAsync(email, "🎉 Registration Successful", responseText);
            }

            if (supabase) {
                const { error } = await supabase
                    .from('it_registrations')
                    .insert([{
                        name: fullname,
                        course: course,
                        email: email,
                        phone: phone,
                        cnic: cnic
                    }]);
                if (error) console.error("Supabase insert error:", error);
            }
        })();

        agent.add(responseText);
    }

    async function digitalIdStatus(agent) {
        const params = agent.parameters || {};

        // Extract name safely
        let person = "Applicant";
        if (params.person) {
            person = typeof params.person === 'object'
                ? (params.person.name || params.person['given-name'] || params.person.displayName || "Applicant")
                : String(params.person).trim() || "Applicant";
        }

        const dgId = String(params.dgId || "—").trim();

        const responseText = `
Hello **${person}** 👋

**Digital ID Application Status**

App ID: **${dgId}**

**Current Status:** Verification in Progress  
**Stage:** Document Review & Background Check  
**Estimated Time Remaining:** 3–7 working days

You will receive an SMS and email notification as soon as your Digital ID is approved or if any additional information is required.

Thank you for your patience — we're working to serve you as quickly as possible.

For urgent queries, contact support: support@digitalwelfare.pk
    `.trim();

        // Optional: also log to supabase if you want tracking
        if (supabase) {
            try {
                const { error } = await supabase
                    .from('digital_id_status_checks')
                    .insert([{
                        name: person,
                        app_id: dgId,
                        checked_at: new Date().toISOString(),
                        channel: 'dialogflow'
                    }]);

                if (error) {
                    console.error("Supabase insert error (Digital ID):", error);
                } else {
                    console.log(`Supabase saved status check for: ${person}`);
                }
            } catch (err) {
                console.error("Supabase unexpected error:", err);
            }
        }

        // Optional: notify admin/team
        sendEmailAsync(
            "bilal317693@gmail.com",
            "Digital ID Status Check",
            `User: ${person}\nApp ID: ${dgId}\nTime: ${new Date().toLocaleString()}`
        ).catch(console.error);

        agent.add(responseText);
    }

    function programInfo(agent) {
        const infoText = `
Our **Digital Welfare & Skills Development Programs** are designed to empower individuals with in-demand digital skills — completely free or highly subsidized.

**Currently Available Courses:**
• **Web Development** (HTML • CSS • JavaScript • React / Node.js)
• **Graphic Design** (Photoshop • Illustrator • UI/UX basics)
• **Digital Marketing** (SEO • Social Media • Google & Facebook Ads)
• **AI & Chatbot Development** (ChatGPT • Dialogflow • Voice bots)
• **Freelancing Mastery** (Upwork • Fiverr • Client handling & proposals)

**Key Benefits:**
→ 100% practical training  
→ Industry-recognized certificates  
→ Job & freelance placement support  
→ One-on-one mentorship (limited seats)

Reply with **"Register"** or **"I want to enroll in [course name]"** to start your journey today.
    `.trim();

        agent.add(infoText);
    }

    // ── Intent Mapping ──────────────────────────────
    let intentMap = new Map();
    intentMap.set('Default Welcome Intent', hi);
    intentMap.set('Default Fallback Intent', fallback);
    intentMap.set('Registration', registration);
    intentMap.set('Digital ID Status', digitalIdStatus);
    intentMap.set('Program Info', programInfo);

    try {
        await agent.handleRequest(intentMap);
    } catch (err) {
        console.error("Webhook critical error:", err);
        if (!res.headersSent) {
            res.status(500).send("Internal Server Error");
        }
    }
});

webApp.listen(PORT, () => {
    console.log(`Server running on port ${PORT}   →   http://localhost:${PORT}/`);
});
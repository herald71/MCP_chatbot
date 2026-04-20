const fs = require('fs');
const axios = require('axios');
const env = fs.readFileSync('.env.local', 'utf8');
const apiKey = env.match(/OPENAI_API_KEY=(.*)/)?.[1]?.trim();

async function testOpenAI() {
    if (!apiKey) {
        console.error("OPENAI_API_KEY not found in .env.local");
        return;
    }
    console.log("Testing OpenAI with Key starting with:", apiKey.substring(0, 10));
    try {
        const response = await axios.post('https://api.openai.com/v1/chat/completions', {
            model: 'gpt-4o',
            messages: [{ role: 'user', content: 'Say hello' }],
        }, {
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${apiKey}`,
            }
        });
        console.log("Status:", response.status);
        console.log("Response:", response.data.choices[0].message.content);
    } catch (e) {
        console.error("Axios Error:", e.response ? JSON.stringify(e.response.data, null, 2) : e.message);
    }
}
testOpenAI();

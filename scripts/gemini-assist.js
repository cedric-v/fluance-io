// scripts/gemini-assist.js
require('dotenv').config();
const { GoogleGenerativeAI } = require("@google/generative-ai");
const fs = require('fs');

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

async function run() {
  const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });
  
  // On récupère l'instruction passée en argument
  const prompt = process.argv[2]; 
  if (!prompt) {
    console.error("❌ Veuillez fournir une instruction entre guillemets.");
    console.log("Exemple : npm run ask-gemini \"Crée un article de blog sur le leadership en Markdown\"");
    return;
  }

  console.log("🤖 Gemini réfléchit...");
  
  const result = await model.generateContent(`
    Tu es un expert web, développeur et rédacteur pour Fluance.io.
    Contexte : Site static 11ty, Tailwind CSS, i18n (FR/EN).
    Tâche : ${prompt}
    Format de réponse : Code ou Markdown uniquement, prêt à copier-coller.
  `);

  const response = await result.response;
  const text = response.text();
  
  // Sauvegarde optionnelle dans un fichier temp pour révision
  fs.writeFileSync('gemini_output.md', text);
  console.log("✅ Réponse générée dans 'gemini_output.md'");
  console.log("--- Aperçu ---");
  console.log(text.substring(0, 500) + "...");
}

run();
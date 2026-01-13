# Corriger le Secret GOOGLE_SERVICE_ACCOUNT

## 🔴 Erreur Actuelle

```
Invalid JSON in GOOGLE_SERVICE_ACCOUNT: Expected property name or '}' in JSON at position 1
```

Cette erreur signifie que le JSON ne commence pas correctement.

## 🔍 Diagnostic

### Vérifier le format du secret actuel

```bash
# Voir les premiers caractères (ne fonctionne que si vous avez les permissions)
firebase functions:secrets:access GOOGLE_SERVICE_ACCOUNT 2>&1 | head -c 200
```

**Résultat attendu :** Le JSON doit commencer par `{` et contenir `"type": "service_account"`

## ✅ Solution : Reconfigurer le Secret

### Méthode 1 : Via le fichier JSON directement (Recommandé)

```bash
# 1. Trouver votre fichier JSON
# Exemple : ~/Downloads/fluance-calendar-sync-xxxxx.json

# 2. Vérifier que le fichier est valide
cat votre-fichier.json | jq . > /dev/null && echo "✅ JSON valide" || echo "❌ JSON invalide"

# 3. Configurer le secret en passant le fichier directement
firebase functions:secrets:set GOOGLE_SERVICE_ACCOUNT < votre-fichier.json
```

### Méthode 2 : Copier-coller manuel

```bash
# 1. Ouvrir le fichier JSON dans un éditeur texte (VS Code, TextEdit)
# 2. Sélectionner TOUT (Cmd+A / Ctrl+A)
# 3. Copier (Cmd+C / Ctrl+C)
# 4. Configurer le secret
firebase functions:secrets:set GOOGLE_SERVICE_ACCOUNT

# 5. Dans le terminal, coller le contenu (Cmd+V / Ctrl+V)
# 6. Appuyer sur Entrée
# 7. Confirmer avec Y
```

### Méthode 3 : Via un script temporaire

```bash
# 1. Créer un script de configuration
cat > /tmp/set-google-secret.sh << 'EOF'
#!/bin/bash
SECRET_FILE="$1"
if [ ! -f "$SECRET_FILE" ]; then
  echo "Usage: $0 <path-to-service-account.json>"
  exit 1
fi

# Vérifier que c'est un JSON valide
if ! jq . "$SECRET_FILE" > /dev/null 2>&1; then
  echo "❌ Le fichier n'est pas un JSON valide"
  exit 1
fi

# Configurer le secret
echo "📋 Configuration du secret GOOGLE_SERVICE_ACCOUNT..."
cat "$SECRET_FILE" | firebase functions:secrets:set GOOGLE_SERVICE_ACCOUNT

echo "✅ Secret configuré avec succès"
EOF

chmod +x /tmp/set-google-secret.sh

# 2. Utiliser le script
/tmp/set-google-secret.sh ~/Downloads/votre-fichier.json
```

## 🔍 Vérification

### Test 1 : Vérifier que le secret est bien configuré

```bash
# Redéployer la fonction
firebase deploy --only functions:syncPlanningManual

# Tester
curl https://europe-west1-fluance-protected-content.cloudfunctions.net/syncPlanningManual
```

**Résultat attendu :**
```json
{
  "success": true,
  "synced": 2,
  "errors": 0
}
```

### Test 2 : Vérifier le format localement

Si vous avez Node.js installé :

```bash
# Créer un script de test
cat > /tmp/test-json.js << 'EOF'
const fs = require('fs');
const filePath = process.argv[2];

if (!filePath) {
  console.error('Usage: node test-json.js <path-to-json>');
  process.exit(1);
}

try {
  const content = fs.readFileSync(filePath, 'utf8');
  console.log('📄 Longueur du fichier:', content.length, 'caractères');
  console.log('📄 Premiers 50 caractères:', JSON.stringify(content.substring(0, 50)));
  console.log('📄 Derniers 50 caractères:', JSON.stringify(content.substring(content.length - 50)));
  
  // Vérifier BOM
  if (content.charCodeAt(0) === 0xFEFF) {
    console.log('⚠️  BOM UTF-8 détecté (sera retiré automatiquement)');
  }
  
  // Parser le JSON
  const json = JSON.parse(content);
  console.log('✅ JSON valide');
  console.log('📋 Type:', json.type);
  console.log('📋 Project ID:', json.project_id);
  console.log('📋 Client Email:', json.client_email);
} catch (error) {
  console.error('❌ Erreur:', error.message);
  process.exit(1);
}
EOF

# Tester votre fichier
node /tmp/test-json.js ~/Downloads/votre-fichier.json
```

## ⚠️ Erreurs Communes

### 1. Copier seulement une partie du JSON
**Symptôme :** JSON invalide, erreur de parsing
**Solution :** Copier TOUT le contenu, de `{` jusqu'à `}`

### 2. Ajouter des retours à la ligne supplémentaires
**Symptôme :** JSON invalide
**Solution :** Coller tel quel, sans modification

### 3. BOM UTF-8 (Byte Order Mark)
**Symptôme :** Erreur "position 1"
**Solution :** Le code gère maintenant le BOM automatiquement, mais vous pouvez aussi sauvegarder le fichier sans BOM

### 4. Caractères invisibles
**Symptôme :** JSON invalide
**Solution :** Utiliser un éditeur texte brut (VS Code, TextEdit en mode texte)

### 5. Fichier corrompu
**Symptôme :** JSON invalide
**Solution :** Télécharger à nouveau le fichier depuis Google Cloud Console

## 📝 Format Attendu

Le JSON doit ressembler à ceci (exemple) :

```json
{
  "type": "service_account",
  "project_id": "votre-projet-id",
  "private_key_id": "abc123def456...",
  "private_key": "-----BEGIN PRIVATE KEY-----\nMIIEvQIBADANBgkqhkiG9w0BAQEFAASCBKcwggSjAgEAAoIBAQC...\n-----END PRIVATE KEY-----\n",
  "client_email": "fluance-calendar-sync@votre-projet.iam.gserviceaccount.com",
  "client_id": "123456789012345678901",
  "auth_uri": "https://accounts.google.com/o/oauth2/auth",
  "token_uri": "https://oauth2.googleapis.com/token",
  "auth_provider_x509_cert_url": "https://www.googleapis.com/oauth2/v1/certs",
  "client_x509_cert_url": "https://www.googleapis.com/robot/v1/metadata/x509/..."
}
```

**Points importants :**
- Commence par `{`
- Se termine par `}`
- Contient `"type": "service_account"`
- Contient `"client_email"` avec `@xxx.iam.gserviceaccount.com`
- `private_key` contient `\n` (retours à la ligne échappés)

## 🚀 Après Correction

1. **Redéployer la fonction :**
   ```bash
   firebase deploy --only functions:syncPlanningManual
   ```

2. **Tester :**
   ```bash
   curl https://europe-west1-fluance-protected-content.cloudfunctions.net/syncPlanningManual
   ```

3. **Vérifier les logs si erreur :**
   ```bash
   firebase functions:log --only syncPlanningManual --limit 10
   ```

Les logs montreront maintenant plus de détails sur le problème (longueur, premiers caractères, etc.).

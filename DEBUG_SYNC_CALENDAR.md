# Debug - Synchronisation Google Calendar

## Erreur : "Expected property name or '}' in JSON at position 1"

Cette erreur indique que le secret `GOOGLE_SERVICE_ACCOUNT` n'est pas un JSON valide.

## Solution

### 1. Vérifier le format du secret

Le secret doit être le **contenu complet** du fichier JSON téléchargé depuis Google Cloud Console, de `{` jusqu'à `}`.

### 2. Reconfigurer le secret

```bash
# 1. Ouvrir le fichier JSON téléchargé
cat /chemin/vers/votre-service-account.json

# 2. Copier TOUT le contenu (de { à })
# 3. Configurer le secret
firebase functions:secrets:set GOOGLE_SERVICE_ACCOUNT

# 4. Coller le contenu complet quand demandé
# ⚠️ IMPORTANT : Coller tout d'un coup, de { jusqu'à }
```

### 3. Vérifier que le JSON est valide

```bash
# Tester le JSON localement
cat votre-service-account.json | jq .
# Si ça fonctionne, le JSON est valide
```

### 4. Format attendu

Le JSON doit ressembler à ceci (exemple) :

```json
{
  "type": "service_account",
  "project_id": "votre-projet",
  "private_key_id": "abc123...",
  "private_key": "-----BEGIN PRIVATE KEY-----\n...\n-----END PRIVATE KEY-----\n",
  "client_email": "xxx@xxx.iam.gserviceaccount.com",
  "client_id": "123456789",
  "auth_uri": "https://accounts.google.com/o/oauth2/auth",
  "token_uri": "https://oauth2.googleapis.com/token",
  "auth_provider_x509_cert_url": "https://www.googleapis.com/oauth2/v1/certs",
  "client_x509_cert_url": "https://www.googleapis.com/robot/v1/metadata/x509/..."
}
```

### 5. Erreurs communes

- ❌ **Copier seulement une partie** : Le JSON doit être complet
- ❌ **Ajouter des retours à la ligne** : Coller tel quel
- ❌ **Oublier les guillemets** : Le JSON doit être valide
- ❌ **Copier depuis un éditeur qui modifie le format** : Utiliser un éditeur texte brut

### 6. Tester après reconfiguration

```bash
# Redéployer les fonctions
firebase deploy --only functions:syncPlanningManual

# Tester
curl https://europe-west1-fluance-protected-content.cloudfunctions.net/syncPlanningManual
```

## Alternative : Vérifier les logs

```bash
# Voir les logs de la fonction
firebase functions:log --only syncPlanningManual
```

Les logs montreront exactement où le parsing échoue.

# Résoudre l'erreur "Error generating the service identity for eventarc.googleapis.com"

## Problème

Lors du déploiement de fonctions scheduled (onSchedule), vous obtenez :
```
Error: Error generating the service identity for eventarc.googleapis.com.
```

## Cause

Eventarc est utilisé par Firebase pour déclencher les fonctions scheduled v2. L'identité de service n'a pas pu être créée automatiquement, généralement à cause de permissions manquantes.

## Solutions

### Solution 1 : Activer l'API Eventarc manuellement (Recommandé)

1. Allez sur [Google Cloud Console](https://console.cloud.google.com/)
2. Sélectionnez le projet : **fluance-protected-content**
3. Allez dans **APIs & Services** > **Library**
4. Cherchez "Eventarc API"
5. Cliquez dessus et activez l'API si elle n'est pas déjà activée
6. Attendez quelques secondes
7. Réessayez le déploiement :
   ```bash
   firebase deploy --only functions:sendCourseReminders
   ```

### Solution 2 : Activer via gcloud CLI

Si vous avez gcloud installé :

```bash
# Activer l'API Eventarc
gcloud services enable eventarc.googleapis.com --project=fluance-protected-content

# Activer aussi les autres APIs nécessaires
gcloud services enable cloudfunctions.googleapis.com --project=fluance-protected-content
gcloud services enable cloudscheduler.googleapis.com --project=fluance-protected-content
gcloud services enable run.googleapis.com --project=fluance-protected-content
gcloud services enable pubsub.googleapis.com --project=fluance-protected-content
```

### Solution 3 : Vérifier les permissions IAM

1. Allez sur [Google Cloud Console](https://console.cloud.google.com/)
2. Sélectionnez le projet : **fluance-protected-content**
3. Allez dans **IAM & Admin** > **IAM**
4. Vérifiez que votre compte a les rôles suivants :
   - **Service Account Admin** ou **Owner**
   - **Cloud Functions Admin**
   - **Service Usage Admin**

Si vous n'avez pas ces rôles, demandez à un administrateur du projet de vous les attribuer.

### Solution 4 : Créer l'identité de service manuellement

1. Allez sur [Google Cloud Console](https://console.cloud.google.com/)
2. Sélectionnez le projet : **fluance-protected-content**
3. Allez dans **IAM & Admin** > **Service Accounts**
4. Cliquez sur **Create Service Account**
5. Nom : `eventarc-service-account`
6. Description : `Service account for Eventarc`
7. Cliquez sur **Create and Continue**
8. **Ne pas ajouter de rôles** (Firebase les gérera)
9. Cliquez sur **Done**

Puis réessayez le déploiement.

### Solution 5 : Réessayer après quelques minutes

Parfois, l'erreur est temporaire. Attendez 5-10 minutes et réessayez :

```bash
firebase deploy --only functions:sendCourseReminders
```

### Solution 6 : Déployer toutes les fonctions d'un coup

Parfois, déployer toutes les fonctions résout le problème :

```bash
firebase deploy --only functions
```

## Vérification

Après avoir appliqué une solution, vérifiez que le déploiement fonctionne :

```bash
firebase deploy --only functions:sendCourseReminders
```

Vous devriez voir :
```
✔  functions[sendCourseReminders(europe-west1)] Successful create operation.
```

## Si le problème persiste

1. Vérifiez les logs dans [Google Cloud Console](https://console.cloud.google.com/) > **Cloud Functions** > **sendCourseReminders** > **Logs**
2. Vérifiez que vous avez les permissions nécessaires dans le projet
3. Contactez le support Firebase si nécessaire

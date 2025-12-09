# Checklist de débogage : Emails de connexion Firebase

## ✅ Vérifications effectuées

- [x] La méthode "Email link (passwordless sign-in)" est activée
- [x] Le code fonctionne (logs montrent un succès)
- [x] Le domaine `fluance.io` est dans les domaines autorisés
- [ ] Le template "Email link sign-in" apparaît (peut apparaître après le premier envoi)
- [ ] L'email arrive dans la boîte de réception

## 🔍 Vérifications restantes à faire

### 1. Vérifier les quotas Firebase (PRIORITÉ 1)

1. Dans Firebase Console, allez dans **Usage and billing**
2. Cliquez sur l'onglet **Usage**
3. Cherchez la section **"Authentication"** ou **"Email sending"**
4. Vérifiez :
   - **Nombre d'emails envoyés aujourd'hui**
   - **Limite quotidienne** (généralement 100 emails/jour pour le plan gratuit)
   - Si vous avez dépassé la limite, les emails ne seront **pas envoyés** (mais Firebase ne retournera pas d'erreur)

**Solution si quota dépassé** :
- Attendre le lendemain (les quotas se réinitialisent à minuit UTC)
- Ou passer à un plan payant Firebase

### 2. Vérifier les spams de manière approfondie (PRIORITÉ 2)

Les emails Firebase sont **très souvent filtrés** comme spam. Vérifiez :

1. **Dans Gmail** :
   - Allez dans **Spam** (courrier indésirable)
   - Recherchez : `from:noreply@fluance-protected-content.firebaseapp.com`
   - Ou recherchez : `fluance` ou `connexion`
   - Vérifiez aussi les **filtres** : Paramètres → Filtres et adresses bloquées

2. **Vérifier les autres dossiers** :
   - **Promotions** (si vous utilisez les onglets Gmail)
   - **Social**
   - **Mises à jour**

3. **Ajouter l'expéditeur aux contacts** :
   - Créez un contact avec l'email : `noreply@fluance-protected-content.firebaseapp.com`
   - Cela peut aider à éviter les filtres

4. **Vérifier les paramètres de sécurité Gmail** :
   - Paramètres → Confidentialité et sécurité
   - Vérifiez que les emails ne sont pas bloqués

### 3. Tester avec un autre email (PRIORITÉ 3)

Pour isoler le problème :

1. **Testez avec un autre email Gmail** (différent de `cedricjourney@gmail.com`)
2. **Testez avec un email Outlook** ou autre fournisseur
3. **Testez avec un email professionnel** (si vous en avez un)

**Objectif** : Déterminer si le problème est spécifique à votre email ou général.

### 4. Vérifier les logs Firebase (si disponibles)

1. Dans Firebase Console, allez dans **Functions**
2. Cliquez sur l'onglet **Logs**
3. Cherchez des erreurs liées à l'envoi d'emails
4. **Note** : Les emails Firebase Auth ne passent généralement pas par Functions, donc vous ne verrez probablement rien ici

### 5. Tester la réinitialisation de mot de passe

Pour comparer avec un autre type d'email Firebase :

1. Allez sur `https://fluance.io/reinitialiser-mot-de-passe`
2. Entrez votre email
3. Vérifiez si vous recevez l'email de réinitialisation

**Interprétation** :
- ✅ Si vous recevez l'email de réinitialisation → Le problème est spécifique aux liens passwordless
- ❌ Si vous ne recevez pas l'email de réinitialisation → Le problème est général avec les emails Firebase Auth

### 6. Vérifier le template par défaut (si visible)

Si le template "Email link sign-in" apparaît maintenant :

1. Cliquez sur **"Email link sign-in"**
2. Vérifiez que le template contient :
   - Un sujet d'email
   - Un contenu HTML avec le lien `%LINK%`
   - Une adresse d'expédition valide

## 🐛 Actions de débogage avancées

### Vérifier les en-têtes d'email (si vous recevez l'email)

Si vous trouvez l'email dans les spams :

1. Ouvrez l'email
2. Cliquez sur **"Afficher l'original"** ou **"View source"**
3. Vérifiez les en-têtes :
   - `From:` devrait être `noreply@fluance-protected-content.firebaseapp.com`
   - `To:` devrait être votre email
   - `Subject:` devrait contenir le sujet du template

### Tester avec l'API Firebase directement

Si vous voulez tester en dehors de votre site :

```javascript
// Dans la console du navigateur sur votre site
firebase.auth().sendSignInLinkToEmail('votre@email.com', {
  url: 'https://fluance.io/connexion-firebase',
  handleCodeInApp: true
}).then(() => {
  console.log('Email envoyé');
}).catch((error) => {
  console.error('Erreur:', error);
});
```

## 📊 Résumé des causes probables

Basé sur votre situation (code OK, méthode activée, domaine autorisé) :

1. **Quotas Firebase dépassés** (60% de probabilité)
   - Vérifiez dans Usage and billing
   - Solution : Attendre ou passer à un plan payant

2. **Emails filtrés comme spam** (30% de probabilité)
   - Vérifiez les spams Gmail
   - Solution : Ajouter l'expéditeur aux contacts

3. **Problème avec le template par défaut** (10% de probabilité)
   - Le template peut être mal configuré
   - Solution : Attendre que le template apparaisse et le configurer

## ✅ Prochaines étapes recommandées

1. **Vérifiez les quotas Firebase** (Usage and billing)
2. **Vérifiez les spams Gmail** de manière approfondie
3. **Testez avec un autre email** (Gmail différent, Outlook, etc.)
4. **Testez la réinitialisation de mot de passe** pour comparer

---

**Date de création** : 2025-12-09


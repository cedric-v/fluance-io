# Guide : Vérifier et obtenir les URLs des webhooks (Fonctions v2)

Ce guide explique comment obtenir les URLs exactes de vos fonctions Firebase v2 pour configurer les webhooks Stripe et PayPal.

## 🔍 Méthode 1 : Via Firebase CLI (Recommandé)

```bash
firebase functions:list
```

Cette commande affiche toutes vos fonctions avec leurs détails, mais pas les URLs complètes.

## 🔍 Méthode 2 : Via la Console Firebase

1. Allez sur [Firebase Console > Functions](https://console.firebase.google.com/project/fluance-protected-content/functions)
2. Cliquez sur la fonction `webhookStripe` ou `webhookPayPal`
3. L'URL complète est affichée dans les détails de la fonction

## 🔍 Méthode 3 : Format standard (Fonctions v2)

Pour les fonctions Firebase v2, les URLs suivent ce format :

```
https://REGION-PROJECT_ID.cloudfunctions.net/FUNCTION_NAME
```

Pour votre projet :
- **Région** : `europe-west1`
- **Project ID** : `fluance-protected-content`
- **Fonctions** : `webhookStripe`, `webhookPayPal`

**URLs attendues :**
- Stripe : `https://europe-west1-fluance-protected-content.cloudfunctions.net/webhookStripe`
- PayPal : `https://europe-west1-fluance-protected-content.cloudfunctions.net/webhookPayPal`

## ✅ Vérification

Pour vérifier que les URLs sont correctes, vous pouvez tester avec `curl` :

```bash
# Tester webhookStripe (devrait retourner une erreur 400 car pas de signature Stripe, mais confirme que la fonction existe)
curl -X POST https://europe-west1-fluance-protected-content.cloudfunctions.net/webhookStripe

# Tester webhookPayPal (devrait retourner une erreur 400 car pas de signature PayPal, mais confirme que la fonction existe)
curl -X POST https://europe-west1-fluance-protected-content.cloudfunctions.net/webhookPayPal
```

Si vous obtenez une erreur 400 (Bad Request) au lieu de 404 (Not Found), cela signifie que la fonction existe et que l'URL est correcte.

## 📝 Note importante : Fonctions v2

Les fonctions v2 utilisent Cloud Run en arrière-plan, mais conservent l'URL au format `cloudfunctions.net` pour la compatibilité. Les deux formats suivants fonctionnent :

1. **Format Firebase (recommandé)** :
   ```
   https://europe-west1-fluance-protected-content.cloudfunctions.net/webhookStripe
   ```

2. **Format Cloud Run** (alternative) :
   ```
   https://webhookstripe-[HASH]-ew.a.run.app
   ```

**Recommandation** : Utilisez le format `cloudfunctions.net` car il est plus stable et ne change pas lors des redéploiements.

## 🔄 Après migration v1 → v2

Si vous avez migré de v1 vers v2, les URLs restent les mêmes. Vous n'avez **pas besoin** de mettre à jour les webhooks dans Stripe/PayPal si vous utilisez le format `cloudfunctions.net`.

## 🚨 Dépannage

### Erreur 404 (Not Found)

- Vérifiez que la fonction est bien déployée : `firebase functions:list`
- Vérifiez que vous utilisez le bon nom de fonction (sensible à la casse)
- Vérifiez que la région est correcte (`europe-west1`)

### Erreur 403 (Forbidden)

- Les fonctions v2 sont publiques par défaut pour les triggers HTTP
- Si vous avez restreint l'accès, vérifiez les règles IAM dans la console Firebase

### Erreur 500 (Internal Server Error)

- Vérifiez les logs : `firebase functions:log --only webhookStripe`
- Vérifiez que les secrets sont bien configurés

## 📚 Ressources

- [Documentation Firebase Functions v2](https://firebase.google.com/docs/functions/2nd-gen)
- [Documentation Cloud Run URLs](https://cloud.google.com/run/docs/mapping-services)

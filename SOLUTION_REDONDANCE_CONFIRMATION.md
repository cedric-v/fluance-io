# Solution : Redondance des pages de confirmation

## Problème identifié

Il y a une redondance entre :
1. **`/confirm/?email=...&token=...&redirect=presentiel`** - Page générique de confirmation d'email (double opt-in)
2. **`/presentiel/confirmation/`** - Page spécifique de confirmation de réservation présentiel

Quand un utilisateur confirme son email via `/confirm/` avec `redirect=presentiel`, il voit d'abord un message de succès, puis doit cliquer sur un bouton pour aller vers `/presentiel/confirmation/`, ce qui crée une redondance.

## Solution implémentée

**Redirection automatique** : Au lieu d'afficher un message avec un bouton, la page `/confirm/` redirige automatiquement vers `/presentiel/confirmation/` quand `redirect=presentiel`.

### Modifications apportées

1. **`src/fr/confirm.md`** : Redirection automatique vers `/presentiel/confirmation/`
2. **`src/en/confirm.md`** : Redirection automatique vers `/en/presentiel/confirmation/`

### Avantages

✅ **Plus simple** : L'utilisateur ne voit qu'une seule page de confirmation
✅ **Moins de clics** : Redirection automatique, pas besoin de cliquer sur un bouton
✅ **Expérience fluide** : Transition directe vers la page de confirmation présentiel
✅ **Pas de redondance** : Une seule page de confirmation visible

## Flux utilisateur après modification

1. Utilisateur clique sur le lien de confirmation dans l'email
2. Page `/confirm/` charge et vérifie le token
3. **Redirection automatique** vers `/presentiel/confirmation/`
4. Utilisateur voit directement la page de confirmation avec toutes les informations pratiques

## Test

Pour tester :
1. Faire une réservation avec un nouvel email
2. Cliquer sur le lien de confirmation dans l'email de double opt-in
3. Vérifier que la redirection vers `/presentiel/confirmation/` est automatique

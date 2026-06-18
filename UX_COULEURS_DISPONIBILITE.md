# Système de Couleurs pour la Disponibilité des Cours

## Vue d'ensemble

Système adaptatif de couleurs pour afficher le nombre de places restantes, basé sur les bonnes pratiques UX et marketing pour créer une urgence appropriée tout en restant accessible.

## Système de Couleurs Adaptatif

Le système utilise **deux critères combinés** pour déterminer la couleur :
1. **Pourcentage de disponibilité** (adaptatif selon la capacité maximale)
2. **Nombre absolu de places** (pour les petits groupes)

### Seuils et Couleurs

| Condition | Couleur | Icône | Message | Urgence | Usage Marketing |
|-----------|---------|-------|---------|---------|-----------------|
| **Complet** (0 places) | 🔴 Rouge | ⚠️ | "Complet" | Critique | - |
| **< 20% OU < 3 places** | 🔴 Rouge | 🔥 | "Dernière place !" ou "X places restantes" | Critique | Crée urgence maximale, encourage action immédiate |
| **20-40% OU 3-5 places** | 🟠 Orange | ⚡ | "X places restantes" | Élevée | Alerte modérée, encourage réservation rapide |
| **40-70%** | 🟡 Amber/Jaune | ✨ | "X places disponibles" | Modérée | Information neutre, pas d'urgence |
| **> 70%** | 🟢 Vert | ✓ | "X places disponibles" | Faible | Rassure sur la disponibilité |

## Avantages du Système Adaptatif

### 1. Fonctionne avec toutes les capacités

- **Petits groupes (10 personnes)** : Le système utilise principalement le nombre absolu (< 3 = rouge)
- **Groupes moyens (15 personnes)** : Combinaison équilibrée des deux critères
- **Grands groupes (20+ personnes)** : Le système utilise principalement le pourcentage

### Exemples

**Cours de 10 personnes :**
- 2 places restantes → 🔴 Rouge (20% mais < 3 places)
- 4 places restantes → 🟠 Orange (40% mais ≤ 5 places)
- 6 places restantes → 🟡 Amber (60%)
- 9 places restantes → 🟢 Vert (90%)

**Cours de 20 personnes :**
- 3 places restantes → 🔴 Rouge (15% < 20%)
- 5 places restantes → 🟠 Orange (25% < 40%)
- 10 places restantes → 🟡 Amber (50% < 70%)
- 15 places restantes → 🟢 Vert (75% > 70%)

## Bonnes Pratiques UX Implémentées

### 1. Psychologie des Couleurs

- **Rouge** : Urgence, action immédiate requise
- **Orange** : Attention, action recommandée
- **Jaune/Amber** : Information neutre
- **Vert** : Disponibilité, rassurance

### 2. Indicateurs Visuels

- **Icônes** : 🔥 (critique), ⚡ (élevé), ✨ (modéré), ✓ (faible)
- **Animation** : Effet `animate-pulse` pour les cas critiques (< 3 places)
- **Badge coloré** : Fond coloré avec bordure pour meilleure visibilité

### 3. Messages Adaptés

- **"Dernière place !"** : Pour 1 place restante (urgence maximale)
- **"X places restantes"** : Pour 2-5 places (créer urgence)
- **"X places disponibles"** : Pour 6+ places (information neutre)

### 4. Accessibilité

- **Contraste suffisant** : Couleurs avec fond clair (bg-*-50)
- **Texte lisible** : Font-semibold pour meilleure lisibilité
- **Pas de dépendance à la couleur seule** : Icônes et texte explicites

## Implémentation Technique

### Fonction `getAvailabilityStyle()`

```javascript
function getAvailabilityStyle(spotsRemaining, maxCapacity, isFull) {
  // Calcule le pourcentage et applique les seuils
  // Retourne : colorClass, bgClass, borderClass, text, urgency, icon
}
```

### Utilisation dans `renderCourseCard()`

```javascript
const availability = getAvailabilityStyle(
  course.spotsRemaining, 
  course.maxCapacity, 
  course.isFull
);
```

### Classes CSS Utilisées

- **Couleurs texte** : `text-red-600`, `text-orange-600`, `text-amber-600`, `text-green-600`
- **Fonds** : `bg-red-50`, `bg-orange-50`, `bg-amber-50`, `bg-green-50`
- **Bordures** : `border-red-200`, `border-orange-200`, `border-amber-200`, `border-green-200`
- **Animation** : `animate-pulse` (pour urgence critique)

## Impact Marketing

### Création d'Urgence Appropriée

1. **Rouge (< 3 places)** : Encourage réservation immédiate
2. **Orange (3-5 places)** : Encourage réservation rapide sans stress excessif
3. **Jaune (40-70%)** : Information neutre, pas de pression
4. **Vert (> 70%)** : Rassure, pas d'urgence

### Éviter le "Cry Wolf"

- Le système ne crie pas au loup : seuls les cas vraiment urgents sont en rouge
- Évite la fatigue des utilisateurs face aux alertes constantes
- Maintient la crédibilité du système

## Tests Recommandés

### Scénarios à Tester

1. **Cours complet** : Affichage "Complet" en rouge
2. **1 place restante** : "Dernière place !" avec animation pulse
3. **2-3 places** : Rouge avec "X places restantes"
4. **4-5 places** : Orange avec "X places restantes"
5. **40-70%** : Amber avec "X places disponibles"
6. **> 70%** : Vert avec "X places disponibles"

### Capacités à Tester

- Petit groupe (10 personnes)
- Groupe moyen (15 personnes)
- Grand groupe (20+ personnes)

## Références

Basé sur les bonnes pratiques UX/marketing :
- Psychologie des couleurs en UX
- Création d'urgence sans stress excessif
- Accessibilité et contraste
- Éviter la fatigue des alertes

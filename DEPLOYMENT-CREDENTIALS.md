# 🔐 Deployment Zugangsdaten

## Passwort setzen

Führen Sie diesen Befehl aus, um das neue Passwort zu aktivieren:

```bash
flyctl secrets set APP_PASSWORD=Claude_is_grea1 --app simavi-semantic-image-vision
```

Die App wird automatisch neu gestartet (dauert ca. 30-60 Sekunden).

---

## Ihre Zugangsdaten

**Deployment URL:** https://simavi-semantic-image-vision.fly.dev

**Benutzername:** admin
**Passwort:** Claude_is_grea1

> **Hinweis:** Die aktuelle Middleware-Implementierung prüft nur das Passwort.
> Der Benutzername kann beliebig sein, wird aber zur Kompatibilität mit Basic Auth benötigt.

---

## Zugriff testen

### Im Browser
1. Öffnen Sie: https://simavi-semantic-image-vision.fly.dev
2. Login-Dialog erscheint (Basic Authentication)
3. Eingeben:
   - Benutzername: `admin`
   - Passwort: `Claude_is_grea1`

### Mit curl
```bash
curl -u admin:Claude_is_grea1 https://simavi-semantic-image-vision.fly.dev/api/health
```

**Erwartete Antwort:**
```json
{
  "status": "ok",
  "timestamp": "2025-11-08T...",
  "service": "Simavi Semantic Image Vision System"
}
```

---

## Passwort später ändern

```bash
flyctl secrets set APP_PASSWORD=NeuesPasswort123 --app simavi-semantic-image-vision
```

---

## Alle Secrets anzeigen (Namen, nicht Werte)

```bash
flyctl secrets list --app simavi-semantic-image-vision
```

**Wichtig:** Fly.io zeigt Secret-Werte aus Sicherheitsgründen nie an.
Bewahren Sie dieses Dokument sicher auf!

---

**Erstellt am:** 2025-11-08
**App Name:** simavi-semantic-image-vision

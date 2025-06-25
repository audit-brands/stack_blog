
From ChatGPT

Below is a focused triage plan that answers each of your questions while giving you a concrete, step-by-step way to pinpoint the break.

1 Why do you hit 404 locally when the process is running?
A 404 means Express walked the middleware stack and never found a matching route —it never reached the part of your code that calls res.render() or res.send(). So either

the routers were never registered (they’re not in the stack), or

they are registered conditionally (e.g. only when NODE_ENV !== 'production' or after some earlier middleware short-circuits the request).

Express itself will happily stay up and return 404 all day long. That is exactly how its default 404 handler is documented 
expressjs.com
.

2 Can Handlebars config break routing?
Almost never. Registering a view engine happens after a route matches. Even if Handlebars failed to render, you would see 500, not 404. So treat the engine switch as a render-time concern, not a router concern.

3 Could the views / layouts structure kill every route?
No. Mis-placed templates simply surface as “template not found” or “cannot find partial” errors, which Express turns into status 500. They do not keep the router from matching.


|   | What to do                                                                                                                                                                                                                                              | Why                                                                                        |                    |                                                                          |
| - | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------ | ------------------ | ------------------------------------------------------------------------ |
| A | **Log the route stack very early** (right after `app.use(...)` calls):<br>`console.log(app._router.stack.filter(l=>l.route).map(l=>l.route.path))`                                                                                                      | Confirms that `/` and `/admin/login` really *exist* inside production.                     |                    |                                                                          |
| B | **Search for env guards** in `app.js` or `routes/*.js`:<br>`if (process.env.NODE_ENV !== 'production') …`                                                                                                                                               | Pair Networks sets `NODE_ENV=production` for you. Dev boxes often don’t.                   |                    |                                                                          |
| C | Run once with **DEBUG=express:**\*:<br>`DEBUG=express:* node app.js`                                                                                                                                                                                    | Shows route mounting and every match attempt—very high-value signal.                       |                    |                                                                          |
| D | Curl the app **with and without the Host header**:<br>`curl -v localhost:8080/`<br>`curl -v -H "Host: cpeio.online" http://127.0.0.1:8080/`                                                                                                             | Confirms it isn’t behind a virtual-host filter such as `vhost()` or `app.use('/blog', …)`. |                    |                                                                          |
| E | Add a **throw-early test route** *above* everything else:<br>`app.get('/__probe', (_,res)=>res.send('alive'));`                                                                                                                                         | If this works while `/` 404s, routing order is the offender.                               |                    |                                                                          |
| F | **Check module format mismatches**: If you converted to ES modules (`export default router`), but still `require('./routes/frontend')`, you’ll get `{default: router}` and nothing mounts. Add `console.log(frontendRouter)` to verify it’s a function. |                                                                                            |                    |                                                                          |
| G | Be sure you **bind to 0.0.0.0** in production:<br>\`app.listen(process.env.PORT                                                                                                                                                                         |                                                                                            | 8080, '0.0.0.0')\` | Some hosts health-check from outside the container’s loopback interface. |
| H | Restart *everything* (PM2/Passenger, Apache-proxy, etc.)—stale Node processes frequently masquerade as brand-new code yet still run the old bundle.                                                                                                     |                                                                                            |                    |                                                                          |


5 Any Express 5 / Node 22 quirks to check?
express@5 (still beta) works on Node 22, but some third-party middleware has not been updated. If you upgraded Express as part of the migration, lock to the latest 4.x and retest before chasing deeper issues.

Node 22 tightened ESM/CJS interop. Double-check that every route file exports in the format you import.

No outstanding express-handlebars vs. Node 22 incompatibilities are reported by the project itself.

(Node 22 went LTS in late 2024 
nodejs.org
.)

6 Could Pair Networks introduce special problems?
Yes, but they usually surface as 503 from the proxy, not 404 from the Node app. Pair marks a backend “unhealthy” when your health-check URL (often /) fails; it then serves a canned 503 page to the public 
pair.com
. Once your root route stops returning 404, the 503s will disappear.

7 Shortest path to “homepage works again”
Add the /__probe test route high in app.js; deploy; hit it.

If probe works, inspect the route stack and env guards.

If probe does not work, your app never reaches the router—look for a crash before app.listen, port-binding issues, or a long-running async call in startup blocking the event loop.

When / responds locally, restart the Pair proxy (or wait for its health-check to re-arm) and retest the public URL.

Finally, restore your admin routes and patch any remaining template errors (those will now show as 500s).


# from the server shell
node -e "const app=require('./app');console.log(app.settings.view engine)"
node -e "const app=require('./app');require('util').inspect.defaultOptions.depth=1;
         console.log(app._router.stack.filter(l=>l.route).map(l=>l.route.path))"
curl -I http://localhost:8080/__probe


If you see your paths in that second command, routing is alive; move on to proxy / health-check fixes. If you see an empty array, your routes never mount—follow steps A-F above.

Good luck—once you get / to register again, everything else (proxy 503s, admin routes, template rendering) should fall back into place.
// Build 404.html: the main app shell, plus a redirect for /NagarTrace/demo/*
// deep links so GitHub Pages serves the demo shell instead of the real app.
import { readFileSync, writeFileSync } from 'fs'
const html = readFileSync('dist/index.html', 'utf8')
const inject = `<script>
  (function () {
    var p = location.pathname
    if (p.indexOf('/NagarTrace/demo') === 0 && p !== '/NagarTrace/demo/' && p !== '/NagarTrace/demo') {
      sessionStorage.setItem('nagartrace-spa-redirect', p + location.search)
      location.replace('/NagarTrace/demo/')
    }
  })()
</script>`
writeFileSync('dist/404.html', html.replace('<head>', '<head>\n    ' + inject))
console.log('404.html written')

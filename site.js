/* =========================================================
   CFS Flooring — runtime vanilla (reemplaza a Alpine.js)
   Interpreta los atributos x-data/x-show/:class/@click/etc.
   con un conjunto cerrado de expresiones (sin eval, sin CSP).
   También maneja el envío de formularios vía FormSubmit AJAX.
   ========================================================= */
(function () {
  'use strict';

  var FORM_ENDPOINT = 'https://formsubmit.co/ajax/cfsflooringllc@outlook.com';
  var FORM_EMAIL = 'cfsflooringllc@outlook.com';

  /* ---------- parser de x-data ---------- */
  function parseXData(str) {
    var scope = {};
    var inner = String(str).trim().replace(/^\{/, '').replace(/\}$/, '');
    inner.split(',').forEach(function (pair) {
      var i = pair.indexOf(':');
      if (i < 1) return;
      var k = pair.slice(0, i).trim();
      var v = pair.slice(i + 1).trim();
      if (v === 'true') scope[k] = true;
      else if (v === 'false') scope[k] = false;
      else if (v === 'null') scope[k] = null;
      else if (/^'[\s\S]*'$/.test(v)) scope[k] = v.slice(1, -1);
      else if (/^-?\d+(\.\d+)?$/.test(v)) scope[k] = parseFloat(v);
      else scope[k] = v;
    });
    return scope;
  }

  /* ---------- evaluador de condiciones (patrones cerrados) ---------- */
  function truthy(expr, scope) {
    expr = expr.trim();
    var m;
    if ((m = expr.match(/^!([A-Za-z_$][\w$]*)$/))) return !scope[m[1]];
    if ((m = expr.match(/^([A-Za-z_$][\w$]*)\s*===\s*'([\s\S]*)'$/))) return scope[m[1]] === m[2];
    if ((m = expr.match(/^([A-Za-z_$][\w$]*)\s*===\s*(-?\d+)$/))) return scope[m[1]] === parseFloat(m[2]);
    if (/^[A-Za-z_$][\w$]*$/.test(expr)) return !!scope[expr];
    console.warn('[site] condición no soportada:', expr);
    return false;
  }

  function evalClass(expr, scope) {
    expr = expr.trim();
    var m = expr.match(/^([\s\S]*?)\s*\?\s*'([\s\S]*)'\s*:\s*'([\s\S]*)'$/);
    if (m) return (truthy(m[1], scope) ? m[2] : m[3]).trim();
    if (expr.charAt(0) === '{') {
      var out = [], mm,
        re = /'([^']*)'\s*:\s*([^,{}]+)/g;
      while ((mm = re.exec(expr))) {
        if (truthy(mm[2].trim(), scope)) out.push(mm[1]);
      }
      return out.join(' ');
    }
    console.warn('[site] :class no soportado:', expr);
    return '';
  }

  function applyClass(el, cls) {
    if (!el._baseClass) el._baseClass = el.getAttribute('class') || '';
    el.setAttribute('class', cls ? (el._baseClass + ' ' + cls).trim() : el._baseClass);
  }

  /* ---------- ejecutor de statements @click ---------- */
  function runStmt(stmt, scope, bindings) {
    stmt = stmt.trim();
    if (!stmt) return;
    var m;
    if ((m = stmt.match(/^\$dispatch\('([\w-]+)'\)$/))) {
      window.dispatchEvent(new CustomEvent(m[1]));
      return;
    }
    if ((m = stmt.match(/^if\(\s*(\w+)\s*!==\s*'([^']+)'\s*\)\s*\{\s*(\w+)\s*=\s*'\2'\s*;\s*(\w+)\s*=\s*true\s*;\s*setTimeout\(\(\)\s*=>\s*(\w+)\s*=\s*false\s*,\s*(\d+)\)\s*;\s*\}$/))) {
      if (scope[m[1]] !== m[2]) {
        scope[m[3]] = m[2];
        scope[m[4]] = true;
        renderScope(scope, bindings);
        setTimeout(function () { scope[m[5]] = false; renderScope(scope, bindings); }, parseInt(m[6], 10));
      }
      return;
    }
    if ((m = stmt.match(/^(\w+)\s*=\s*!\1$/))) { scope[m[1]] = !scope[m[1]]; return; }
    if ((m = stmt.match(/^(\w+)\s*=\s*\((\w+)\s*===\s*(\d+)\)\s*\?\s*null\s*:\s*(\d+)$/))) {
      scope[m[1]] = (scope[m[2]] === parseFloat(m[3])) ? null : parseFloat(m[4]);
      return;
    }
    if ((m = stmt.match(/^(\w+)\s*=\s*\((\w+)\s*===\s*(\d+)\)\s*\?\s*(\d+)\s*:\s*(\w+)\s*-\s*1$/))) {
      scope[m[1]] = (scope[m[2]] === parseFloat(m[3])) ? parseFloat(m[4]) : scope[m[5]] - 1;
      return;
    }
    if ((m = stmt.match(/^(\w+)\s*=\s*\((\w+)\s*===\s*(\d+)\)\s*\?\s*(\d+)\s*:\s*(\w+)\s*\+\s*1$/))) {
      scope[m[1]] = (scope[m[2]] === parseFloat(m[3])) ? parseFloat(m[4]) : scope[m[5]] + 1;
      return;
    }
    if ((m = stmt.match(/^(\w+)\s*=\s*(true|false)$/))) { scope[m[1]] = (m[2] === 'true'); return; }
    if ((m = stmt.match(/^(\w+)\s*=\s*(-?\d+)$/))) { scope[m[1]] = parseFloat(m[2]); return; }
    if ((m = stmt.match(/^(\w+)\s*=\s*'([\s\S]*)'$/))) { scope[m[1]] = m[2]; return; }
    console.warn('[site] expresión no soportada:', stmt);
  }

  function runActions(expr, scope, bindings, el) {
    if (expr.indexOf('submitted = true') !== -1 && expr.indexOf('setTimeout') !== -1) {
      handleFormSubmit(el.closest('form'), scope, bindings);
      return;
    }
    expr.split(';').forEach(function (s) { runStmt(s, scope, bindings); });
  }

  /* ---------- render de un scope ---------- */
  function renderScope(scope, bindings) {
    bindings.forEach(function (bnd) {
      if (bnd.type === 'show') {
        bnd.el.style.display = truthy(bnd.expr, scope) ? '' : 'none';
      } else if (bnd.type === 'class') {
        applyClass(bnd.el, evalClass(bnd.expr, scope));
      } else if (bnd.type === 'aria') {
        bnd.el.setAttribute(bnd.attr, truthy(bnd.expr, scope) ? 'true' : 'false');
      } else if (bnd.type === 'disabled') {
        if (truthy(bnd.expr, scope)) bnd.el.setAttribute('disabled', 'disabled');
        else bnd.el.removeAttribute('disabled');
      }
    });
    if (scope.hasOwnProperty('mobileMenuOpen')) {
      document.body.style.overflow = scope.mobileMenuOpen ? 'hidden' : '';
      var header = document.getElementById('mainHeader');
      if (scope.mobileMenuOpen && header) header.classList.remove('-translate-y-full');
    }
  }

  /* ---------- formularios: FormSubmit (método obligatorio) ---------- */
  function handleFormSubmit(form, scope, bindings) {
    if (!form || form._sending) return;
    var data = new FormData(form);
    if ((data.get('_honey') || '').trim()) return; // honeypot: bot
    data.append('_subject', 'Request — CFS Flooring website');
    data.append('_template', 'table');
    if (scope) scope.loading = true;
    if (bindings) renderScope(scope, bindings);
    fetch(FORM_ENDPOINT, {
      method: 'POST',
      body: data,
      headers: { 'Accept': 'application/json' }
    })
      .then(function (res) {
        if (!res.ok) throw new Error('HTTP ' + res.status);
        return res.json().catch(function () { return {}; });
      })
      .then(function () {
        if (scope) { scope.loading = false; scope.submitted = true; renderScope(scope, bindings); }
      })
      .catch(function () {
        if (scope) scope.loading = false;
        if (bindings) renderScope(scope, bindings);
        var lines = [];
        data.forEach(function (v, k) {
          if (k.indexOf('_') !== 0) lines.push(k + ': ' + v);
        });
        window.location.href = 'mailto:' + FORM_EMAIL +
          '?subject=' + encodeURIComponent('Request — CFS Flooring website') +
          '&body=' + encodeURIComponent(lines.join('\n'));
      });
  }

  /* ---------- init ---------- */
  function init() {
    var scopes = [];

    document.querySelectorAll('[x-data]').forEach(function (el) {
      var scope = parseXData(el.getAttribute('x-data'));
      el._scope = scope;
      var bindings = [];

      el.querySelectorAll('*').forEach(function (child) {
        // x-show
        var xs = child.getAttribute && child.getAttribute('x-show');
        if (xs !== null && xs !== undefined) {
          bindings.push({ type: 'show', el: child, expr: xs });
        }
        // :class
        var xc = child.getAttribute && child.getAttribute(':class');
        if (xc) bindings.push({ type: 'class', el: child, expr: xc });
        // :aria-expanded / :aria-selected
        ['aria-expanded', 'aria-selected'].forEach(function (a) {
          var v = child.getAttribute && child.getAttribute(':' + a);
          if (v) bindings.push({ type: 'aria', el: child, expr: v, attr: a });
        });
        // :disabled y ::disabled (typo heredado)
        ['disabled', ':disabled', '::disabled'].forEach(function (a) {
          var v = child.getAttribute && child.getAttribute(':' + a.replace(/^:+/, ':'));
          if (v && a !== 'disabled') bindings.push({ type: 'disabled', el: child, expr: v });
        });
      });

      scopes.push({ el: el, scope: scope, bindings: bindings });
      el._scope = scope;
      el._bindings = bindings;
    });

    // enlaces de eventos por scope
    scopes.forEach(function (s) {
      var el = s.el, scope = s.scope, bindings = s.bindings;
      var render = function () { renderScope(scope, bindings); };

      el.querySelectorAll('*').forEach(function (child) {
        var click = child.getAttribute && child.getAttribute('@click');
        if (click) {
          child.addEventListener('click', function (ev) {
            ev.preventDefault();
            runActions(click, scope, bindings, child);
            render();
          });
        }
        var enter = child.getAttribute && child.getAttribute('@mouseenter');
        if (enter) child.addEventListener('mouseenter', function () { runActions(enter, scope, bindings, child); render(); });
        var leave = child.getAttribute && child.getAttribute('@mouseleave');
        if (leave) child.addEventListener('mouseleave', function () { runActions(leave, scope, bindings, child); render(); });
        var model = child.getAttribute && child.getAttribute('x-model');
        if (model) child.addEventListener('input', function () { scope[model] = child.value; });
      });

      // eventos de ventana
      var esc = el.getAttribute && el.getAttribute('@keydown.escape.window');
      if (esc) window.addEventListener('keydown', function (e) { if (e.key === 'Escape') { runActions(esc, scope, bindings, el); render(); } });
      var onWin = el.getAttribute && el.getAttribute('@open-drawer.window');
      if (onWin) window.addEventListener('open-drawer', function () { runActions(onWin, scope, bindings, el); render(); });
      var outside = el.getAttribute && el.getAttribute('@click.outside');
      if (outside) document.addEventListener('click', function (e) {
        if (!el.contains(e.target)) { runActions(outside, scope, bindings, el); render(); }
      });

      render();
    });

    // quitar x-cloak ahora que los estados iniciales están aplicados
    document.querySelectorAll('[x-cloak]').forEach(function (el) {
      el.removeAttribute('x-cloak');
    });

    // formularios: honeypot + envío FormSubmit (método obligatorio, sin registro)
    document.querySelectorAll('form').forEach(function (form) {
      if (!form.hasAttribute('@submit.prevent')) return;
      var scopeEl = form.closest('[x-data]');
      var s = scopeEl && scopeEl._scope;
      var b = scopeEl && scopeEl._bindings;
      var honey = document.createElement('input');
      honey.type = 'text';
      honey.name = '_honey';
      honey.tabIndex = -1;
      honey.setAttribute('autocomplete', 'off');
      honey.style.cssText = 'position:absolute;left:-9999px;opacity:0;height:0;overflow:hidden';
      form.appendChild(honey);
      form.addEventListener('submit', function (ev) {
        ev.preventDefault();
        handleFormSubmit(form, s, b);
      });
    });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();

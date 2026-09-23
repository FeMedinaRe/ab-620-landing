(function () {
  "use strict";

  var DOMAIN_LABELS = {
    1: "Dominio 1",
    2: "Dominio 2",
    3: "Dominio 3"
  };

  var state = {
    questions: [],
    filter: "all",
    answers: {}
  };

  /* ---------- Tabs ---------- */
  function initTabs() {
    var tabs = Array.prototype.slice.call(document.querySelectorAll(".tab"));
    var panels = Array.prototype.slice.call(document.querySelectorAll(".panel"));

    function activate(index) {
      tabs.forEach(function (tab, i) {
        var selected = i === index;
        tab.classList.toggle("is-active", selected);
        tab.setAttribute("aria-selected", selected ? "true" : "false");
        tab.tabIndex = selected ? 0 : -1;
      });
      panels.forEach(function (panel, i) {
        var active = i === index;
        panel.classList.toggle("is-active", active);
        if (active) {
          panel.removeAttribute("hidden");
        } else {
          panel.setAttribute("hidden", "");
        }
      });
    }

    tabs.forEach(function (tab, i) {
      tab.addEventListener("click", function () {
        activate(i);
      });
      tab.addEventListener("keydown", function (e) {
        var next = null;
        if (e.key === "ArrowRight" || e.key === "ArrowDown") next = (i + 1) % tabs.length;
        if (e.key === "ArrowLeft" || e.key === "ArrowUp") next = (i - 1 + tabs.length) % tabs.length;
        if (e.key === "Home") next = 0;
        if (e.key === "End") next = tabs.length - 1;
        if (next !== null) {
          e.preventDefault();
          activate(next);
          tabs[next].focus();
        }
      });
    });
  }

  /* ---------- Quiz ---------- */
  function loadQuiz() {
    var status = document.getElementById("quiz-status");
    fetch("data/quiz.json")
      .then(function (res) {
        if (!res.ok) throw new Error("HTTP " + res.status);
        return res.json();
      })
      .then(function (data) {
        state.questions = data.questions || [];
        if (!state.questions.length) throw new Error("Sin preguntas");
        status.textContent = state.questions.length + " preguntas disponibles.";
        renderQuiz();
        initFilters();
        updateScore();
      })
      .catch(function (err) {
        status.textContent = "No se pudo cargar el quiz (" + err.message + "). ¿Estás sirviendo la página con un servidor local?";
      });

    document.getElementById("btn-reset").addEventListener("click", resetQuiz);
  }

  function filteredQuestions() {
    if (state.filter === "all") return state.questions;
    return state.questions.filter(function (q) {
      return String(q.domain) === String(state.filter);
    });
  }

  function initFilters() {
    var buttons = Array.prototype.slice.call(document.querySelectorAll(".chip-btn"));
    buttons.forEach(function (btn) {
      btn.addEventListener("click", function () {
        buttons.forEach(function (b) { b.classList.remove("is-active"); });
        btn.classList.add("is-active");
        state.filter = btn.getAttribute("data-filter");
        renderQuiz();
        updateScore();
      });
    });
  }

  function renderQuiz() {
    var list = document.getElementById("quiz-list");
    list.innerHTML = "";
    var questions = filteredQuestions();

    questions.forEach(function (q, idx) {
      var li = document.createElement("li");
      li.className = "question-card";
      li.dataset.id = q.id;

      var head = document.createElement("div");
      head.className = "question-head";
      head.innerHTML =
        '<span class="question-index">Q' + q.id + '</span>' +
        '<p class="question-text">' + escapeHtml(q.question) + "</p>" +
        '<span class="question-domain">' + (DOMAIN_LABELS[q.domain] || "") + "</span>";
      li.appendChild(head);

      var opts = document.createElement("div");
      opts.className = "options";
      opts.setAttribute("role", "radiogroup");
      opts.setAttribute("aria-label", "Opciones para la pregunta " + q.id);

      q.options.forEach(function (text, oi) {
        var label = document.createElement("label");
        label.className = "option";
        var input = document.createElement("input");
        input.type = "radio";
        input.name = "q-" + q.id;
        input.value = String(oi);
        input.addEventListener("change", function () {
          state.answers[q.id] = oi;
          Array.prototype.forEach.call(opts.children, function (el) {
            el.classList.remove("is-selected");
          });
          label.classList.add("is-selected");
          var check = li.querySelector(".btn-check");
          if (check) check.disabled = false;
        });
        label.appendChild(input);
        label.appendChild(document.createTextNode(escapeHtml(text)));
        opts.appendChild(label);
      });

      li.appendChild(opts);

      var actions = document.createElement("div");
      actions.className = "question-actions";

      var btnCheck = document.createElement("button");
      btnCheck.type = "button";
      btnCheck.className = "btn btn-primary btn-sm btn-check";
      btnCheck.textContent = "Comprobar";
      btnCheck.disabled = state.answers[q.id] === undefined;
      btnCheck.addEventListener("click", function () { checkAnswer(q, li); });
      actions.appendChild(btnCheck);

      var btnReveal = document.createElement("button");
      btnReveal.type = "button";
      btnReveal.className = "btn btn-outline btn-sm";
      btnReveal.textContent = "Ver respuesta";
      btnReveal.addEventListener("click", function () { revealAnswer(q, li); });
      actions.appendChild(btnReveal);

      li.appendChild(actions);
      list.appendChild(li);
    });
  }

  function optionElements(li) {
    return Array.prototype.slice.call(li.querySelectorAll(".option"));
  }

  function markOptions(q, li) {
    optionElements(li).forEach(function (el, oi) {
      el.classList.remove("is-correct", "is-wrong");
      if (oi === q.correctAnswer) el.classList.add("is-correct");
      else if (state.answers[q.id] === oi) el.classList.add("is-wrong");
    });
    Array.prototype.forEach.call(li.querySelectorAll("input"), function (input) {
      input.disabled = true;
    });
    var check = li.querySelector(".btn-check");
    if (check) check.disabled = true;
  }

  function feedbackHtml(q, ok) {
    var correctText = q.options[q.correctAnswer];
    return (
      '<div class="feedback ' + (ok ? "ok" : "bad") + '">' +
      "<strong>" + (ok ? "¡Correcto!" : "Incorrecta. Respuesta correcta: " + escapeHtml(correctText)) + "</strong>" +
      escapeHtml(q.explanation) +
      "</div>"
    );
  }

  function checkAnswer(q, li) {
    var chosen = state.answers[q.id];
    if (chosen === undefined) return;
    markOptions(q, li);
    removeFeedback(li);
    li.insertAdjacentHTML("beforeend", feedbackHtml(q, chosen === q.correctAnswer));
    updateScore();
  }

  function revealAnswer(q, li) {
    if (state.answers[q.id] === undefined) {
      state.answers[q.id] = -1;
    }
    markOptions(q, li);
    removeFeedback(li);
    li.insertAdjacentHTML("beforeend", feedbackHtml(q, false));
    updateScore();
  }

  function removeFeedback(li) {
    var fb = li.querySelector(".feedback");
    if (fb) fb.remove();
  }

  function updateScore() {
    var el = document.getElementById("quiz-score");
    var questions = filteredQuestions();
    var correct = 0;
    var answered = 0;
    questions.forEach(function (q) {
      if (state.answers[q.id] !== undefined && state.answers[q.id] !== -1) {
        answered++;
        if (state.answers[q.id] === q.correctAnswer) correct++;
      }
    });
    el.textContent = correct + " / " + questions.length + " correctas" +
      (answered ? " (" + answered + " revisadas)" : "");
  }

  function resetQuiz() {
    state.answers = {};
    renderQuiz();
    updateScore();
    document.getElementById("quiz-status").textContent =
      state.questions.length + " preguntas disponibles. Reiniciado.";
  }

  function escapeHtml(str) {
    return String(str)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }

  /* ---------- Smooth scroll + to-top ---------- */
  function initScroll() {
    document.querySelectorAll('a[href^="#"]').forEach(function (link) {
      link.addEventListener("click", function (e) {
        var id = link.getAttribute("href");
        if (id.length < 2) return;
        var target = document.querySelector(id);
        if (!target) return;
        e.preventDefault();
        target.scrollIntoView({ behavior: "smooth", block: "start" });
        history.pushState(null, "", id);
      });
    });

    var toTop = document.getElementById("to-top");
    window.addEventListener("scroll", function () {
      toTop.hidden = window.scrollY < 400;
    }, { passive: true });
    toTop.addEventListener("click", function () {
      window.scrollTo({ top: 0, behavior: "smooth" });
    });
  }

  document.addEventListener("DOMContentLoaded", function () {
    initTabs();
    loadQuiz();
    initScroll();
  });
})();

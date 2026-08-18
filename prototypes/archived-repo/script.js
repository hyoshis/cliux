const responses = {
  No: "SUCCESS: Init cancelled.",
  Yes: "SUCCESS: Continuing with archived template.",
};

document.querySelectorAll(".terminal").forEach((terminal) => {
  const choice = terminal.querySelector(".choice");
  const result = terminal.querySelector(".result");

  choice.addEventListener("click", () => {
    const nextChoice = choice.textContent === "No" ? "Yes" : "No";
    choice.textContent = nextChoice;
    result.textContent = responses[nextChoice];
  });
});

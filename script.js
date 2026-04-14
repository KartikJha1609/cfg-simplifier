function insertEpsilon() {
    const textarea = document.getElementById('grammar-input');
    if (!textarea) {
        console.error("Could not find textarea with ID 'grammar-input'");
        return;
    }
    const cursorPos = textarea.selectionStart;
    const textBefore = textarea.value.substring(0, cursorPos);
    const textAfter = textarea.value.substring(textarea.selectionEnd);
    
    textarea.value = textBefore + 'ε' + textAfter;
    
    // Put the cursor back after the ε
    textarea.selectionStart = textarea.selectionEnd = cursorPos + 1;
    textarea.focus();
}
function processGrammar() {
    const input = document.getElementById('grammar-input').value;
    const visualization = document.getElementById('visualization');
    visualization.innerHTML = ""; 

    let grammar = parseGrammar(input);
    
    // Step 1: Null
    const step1 = eliminateNull(grammar);
    displayStep("Step 1: Eliminate Null Productions (ε)", step1.explanation, step1.rules);
    grammar = step1.rules;

    // Step 2: Unit
    const step2 = eliminateUnit(grammar);
    displayStep("Step 2: Eliminate Unit Productions", step2.explanation, step2.rules);
    grammar = step2.rules;

    // Step 3: Useless
    const step3 = eliminateUseless(grammar);
    displayStep("Step 3: Eliminate Useless Symbols", step3.explanation, step3.rules);
    grammar = step3.rules;

    displayStep("Final Simplified Grammar", "All 3 simplification steps are complete. Here is your final, clean Context-Free Grammar.", grammar);
}

function parseGrammar(text) {
    const lines = text.split('\n');
    const grammar = {};
    lines.forEach(line => {
        if (!line.trim()) return;
        // Supports both -> and →
        let delimiter = line.includes('->') ? '->' : '→';
        let [lhs, rhs] = line.split(delimiter).map(s => s.trim());
        if (!grammar[lhs]) grammar[lhs] = new Set();
        rhs.split('|').forEach(prod => grammar[lhs].add(prod.trim()));
    });
    return grammar;
}

function formatGrammar(grammar) {
    let output = "";
    for (let lhs in grammar) {
        output += `${lhs} -> ${Array.from(grammar[lhs]).join(' | ')}\n`;
    }
    return output || "Empty Grammar";
}

function displayStep(title, explanation, grammar) {
    const container = document.getElementById('visualization');
    const card = document.createElement('div');
    card.className = 'step-card';
    
    card.innerHTML = `
        <h2>${title}</h2>
        <div class="explanation">${explanation}</div>
        <div class="grammar-display">${formatGrammar(grammar)}</div>
    `;
    container.appendChild(card);
}

function isVariable(char) {
    return /[A-Z]/.test(char);
}

function eliminateNull(grammar) {
    let nullable = new Set();
    let originalStart = Object.keys(grammar)[0];
    let startOnRHS = false;

    // Identify if Start Symbol appears on RHS anywhere
    for (let lhs in grammar) {
        for (let prod of grammar[lhs]) {
            if (prod.includes(originalStart)) startOnRHS = true;
            if (grammar[lhs].has('eps') || grammar[lhs].has('ε')) {
                nullable.add(lhs);
            }
        }
    }

    // Fixed Nullable Identification (Transitive)
    let added = true;
    while (added) {
        added = false;
        for (let lhs in grammar) {
            if (nullable.has(lhs)) continue;
            for (let prod of grammar[lhs]) {
                if (prod !== 'ε' && prod !== 'eps' && prod.split('').every(char => nullable.has(char))) {
                    nullable.add(lhs);
                    added = true;
                    break;
                }
            }
        }
    }

    let newGrammar = {};
    for (let lhs in grammar) {
        let newProds = new Set();
        grammar[lhs].forEach(prod => {
            if (prod === 'eps' || prod === 'ε') return;
            let chars = prod.split('');
            let nullableIndices = [];
            for (let i = 0; i < chars.length; i++) {
                if (nullable.has(chars[i])) nullableIndices.push(i);
            }

            let totalCombos = 1 << nullableIndices.length; 
            for (let i = 0; i < totalCombos; i++) {
                let current = "";
                for (let j = 0; j < chars.length; j++) {
                    let isNullableIdx = nullableIndices.indexOf(j);
                    if (isNullableIdx !== -1) {
                        if ((i & (1 << isNullableIdx)) === 0) current += chars[j];
                    } else {
                        current += chars[j];
                    }
                }
                if (current !== "") newProds.add(current);
            }
        });
        if (newProds.size > 0) newGrammar[lhs] = newProds;
    }

    let explanation = "";
    let finalRules = {};

    if (nullable.size === 0) {
        explanation = "No changes needed at this step as there are no nullable variables.";
        finalRules = newGrammar;
    } else {
        let addedNullProds = [];
        let specialRuleMsg = "";

        // S -> ε Handling Logic
        if (nullable.has(originalStart)) {
            if (startOnRHS) {
                let newStart = originalStart + "0";
                finalRules[newStart] = new Set([originalStart, 'ε']);
                specialRuleMsg = `<br><i style="color: #ec4899;"><b>Special Rule:</b> ${originalStart} is nullable and appears on RHS. Created new start symbol ${newStart} -> ${originalStart} | ε.</i>`;
            } else {
                if (!newGrammar[originalStart]) newGrammar[originalStart] = new Set();
                newGrammar[originalStart].add('ε');
                specialRuleMsg = `<br><i><b>Note:</b> ${originalStart} is nullable but not on RHS. ε preserved in original start symbol.</i>`;
            }
        }
        
        // Merge remaining rules
        for (let lhs in newGrammar) finalRules[lhs] = newGrammar[lhs];

        // Compensation tracking for explanation
        for (let lhs in newGrammar) {
            newGrammar[lhs].forEach(prod => {
                if (!grammar[lhs] || !grammar[lhs].has(prod)) {
                    addedNullProds.push(`${lhs} -> ${prod}`);
                }
            });
        }

        explanation = `<b>Identified nullable variables:</b> [ ${Array.from(nullable).join(', ')} ]<br>`;
        explanation += `Removed epsilon productions and generated combinations.${specialRuleMsg}`;
        if (addedNullProds.length > 0) {
            explanation += `<br><br><b>Compensation productions added:</b> [ ${addedNullProds.join(', ')} ]`;
        }
    }

    return { rules: finalRules, explanation: explanation };
}

function eliminateUnit(grammar) {
    let newGrammar = {};
    let variables = Object.keys(grammar);
    let unitsFound = false;
    let directUnits = [];

    variables.forEach(A => {
        if (grammar[A]) {
            grammar[A].forEach(prod => {
                if (prod.length === 1 && isVariable(prod)) {
                    directUnits.push(`${A} -> ${prod}`);
                    unitsFound = true;
                }
            });
        }
    });

    let unitPairs = {};
    variables.forEach(A => {
        unitPairs[A] = new Set([A]); 
        let queue = [A];
        while (queue.length > 0) {
            let curr = queue.shift();
            if (grammar[curr]) {
                grammar[curr].forEach(prod => {
                    if (prod.length === 1 && isVariable(prod)) {
                        if (!unitPairs[A].has(prod)) {
                            unitPairs[A].add(prod);
                            queue.push(prod);
                        }
                    }
                });
            }
        }
    });

    variables.forEach(A => {
        newGrammar[A] = new Set();
        unitPairs[A].forEach(B => {
            if (grammar[B]) {
                grammar[B].forEach(prod => {
                    // Don't add unit productions or self-loops (A -> A)
                    if (!(prod.length === 1 && isVariable(prod)) && prod !== A) {
                        newGrammar[A].add(prod);
                    }
                });
            }
        });
    });

    for (let lhs in newGrammar) if (newGrammar[lhs].size === 0) delete newGrammar[lhs];

    let explanation = "";
    if (!unitsFound) {
        explanation = "No changes needed at this step as there are no unit productions.";
    } else {
        let addedUnitProds = [];
        for (let lhs in newGrammar) {
            newGrammar[lhs].forEach(prod => {
                if (!grammar[lhs] || !grammar[lhs].has(prod)) {
                    addedUnitProds.push(`${lhs} -> ${prod}`);
                }
            });
        }

        explanation = `<b>Removed Unit Productions:</b> [ ${directUnits.join(', ')} ]<br>`;
        if (addedUnitProds.length > 0) {
            explanation += `<br><b>Compensation productions added:</b> [ ${addedUnitProds.join(', ')} ]<br><br>`;
        }
        
        variables.forEach(A => {
            let reachable = Array.from(unitPairs[A]).filter(x => x !== A);
            if (reachable.length > 0) {
                explanation += `<i>Copied non-unit productions from [ ${reachable.join(', ')} ] to ${A}.</i><br>`;
            }
        });
    }

    return { rules: newGrammar, explanation: explanation };
}

function eliminateUseless(grammar) {
    let startSymbol = Object.keys(grammar)[0];
    let allVars = new Set(Object.keys(grammar));
    for (let lhs in grammar) {
        grammar[lhs].forEach(prod => {
            prod.split('').forEach(char => { if (isVariable(char)) allVars.add(char); });
        });
    }

    // Phase 1: Generating
    let generating = new Set();
    let added = true;
    while (added) {
        added = false;
        for (let lhs in grammar) {
            if (generating.has(lhs)) continue;
            for (let prod of grammar[lhs]) {
                let isGen = prod.split('').every(char => !isVariable(char) || generating.has(char) || char === 'ε');
                if (isGen) {
                    generating.add(lhs);
                    added = true;
                    break;
                }
            }
        }
    }

    let step1Grammar = {};
    for (let lhs in grammar) {
        if (!generating.has(lhs)) continue; 
        let newProds = new Set();
        grammar[lhs].forEach(prod => {
            if (prod.split('').every(char => !isVariable(char) || generating.has(char) || char === 'ε')) {
                newProds.add(prod);
            }
        });
        if (newProds.size > 0) step1Grammar[lhs] = newProds;
    }

    // Phase 2: Reachable
    let reachable = new Set([startSymbol]); 
    let queue = [startSymbol];
    while (queue.length > 0) {
        let curr = queue.shift();
        if (step1Grammar[curr]) {
            step1Grammar[curr].forEach(prod => {
                prod.split('').forEach(char => {
                    if (isVariable(char) && !reachable.has(char)) {
                        reachable.add(char);
                        queue.push(char);
                    }
                });
            });
        }
    }

    let finalGrammar = {};
    reachable.forEach(lhs => { if (step1Grammar[lhs]) finalGrammar[lhs] = step1Grammar[lhs]; });

    let nonGeneratingArr = Array.from(allVars).filter(v => !generating.has(v));
    let nonReachableArr = Array.from(Object.keys(step1Grammar)).filter(v => !reachable.has(v));

    let explanation = "";
    if (nonGeneratingArr.length === 0 && nonReachableArr.length === 0) {
        explanation = "No changes needed at this step as there are no useless symbols.";
    } else {
        let removedUselessProds = [];
        for (let lhs in grammar) {
            grammar[lhs].forEach(prod => {
                if (!finalGrammar[lhs] || !finalGrammar[lhs].has(prod)) {
                    removedUselessProds.push(`${lhs} -> ${prod}`);
                }
            });
        }

        explanation = `<b>Phase 1: Generating Symbols</b><br>`;
        explanation += `- Generating variables: [ ${Array.from(generating).join(', ') || 'None'} ]<br>`;
        explanation += `- Non-generating variables: [ ${nonGeneratingArr.join(', ') || 'None'} ]<br><br>`;
        
        explanation += `<b>Phase 2: Reachable Symbols</b><br>`;
        explanation += `- Reachable variables: [ ${Array.from(reachable).join(', ') || 'None'} ]<br>`;
        explanation += `- Non-reachable variables: [ ${nonReachableArr.join(', ') || 'None'} ]<br><br>`;

        if (removedUselessProds.length > 0) {
            explanation += `<b>Productions removed:</b> [ ${removedUselessProds.join(', ')} ]`;
        }
    }

    return { rules: finalGrammar, explanation: explanation };
}
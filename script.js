function processGrammar() {
    const input = document.getElementById('grammar-input').value;
    const visualization = document.getElementById('visualization');
    visualization.innerHTML = ""; // Clear previous results

    let grammar = parseGrammar(input);
    
    // Step 1: Eliminate Null Productions
    const step1 = eliminateNull(grammar);
    displayStep("Step 1: Eliminate Null Productions (ε)", step1.explanation, step1.rules);
    grammar = step1.rules;

    // Step 2: Eliminate Unit Productions
    const step2 = eliminateUnit(grammar);
    displayStep("Step 2: Eliminate Unit Productions", step2.explanation, step2.rules);
    grammar = step2.rules;

    // Step 3: Eliminate Useless Symbols
    const step3 = eliminateUseless(grammar);
    displayStep("Step 3: Eliminate Useless Symbols", step3.explanation, step3.rules);
    grammar = step3.rules;

    // Final Result
    displayStep("Final Simplified Grammar", "All 3 simplification steps are complete. Here is your final, clean Context-Free Grammar.", grammar);
}

function parseGrammar(text) {
    const lines = text.split('\n');
    const grammar = {};
    lines.forEach(line => {
        if (!line.trim()) return;
        let [lhs, rhs] = line.split('->').map(s => s.trim());
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

// Helper function to strictly enforce that Uppercase letters are Variables
function isVariable(char) {
    return /[A-Z]/.test(char);
}

// --- LOGIC FUNCTIONS WITH REASONING ---

// --- LOGIC FUNCTIONS WITH REASONING ---

function eliminateNull(grammar) {
    let nullable = new Set();
    
    // Find direct nullables
    for (let lhs in grammar) {
        if (grammar[lhs].has('e')) {
            nullable.add(lhs);
            grammar[lhs].delete('e');
        }
    }

    // Find indirect nullables
    let added = true;
    while (added) {
        added = false;
        for (let lhs in grammar) {
            if (nullable.has(lhs)) continue;
            for (let prod of grammar[lhs]) {
                if (prod.split('').every(char => nullable.has(char))) {
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
            if (prod === 'e') return;

            let chars = prod.split('');
            let nullableIndices = [];
            
            for (let i = 0; i < chars.length; i++) {
                if (nullable.has(chars[i])) {
                    nullableIndices.push(i);
                }
            }

            let totalCombos = 1 << nullableIndices.length; 
            for (let i = 0; i < totalCombos; i++) {
                let current = "";
                for (let j = 0; j < chars.length; j++) {
                    let isNullableIndex = nullableIndices.indexOf(j);
                    if (isNullableIndex !== -1) {
                        if ((i & (1 << isNullableIndex)) === 0) {
                            current += chars[j];
                        }
                    } else {
                        current += chars[j];
                    }
                }
                if (current !== "") {
                    newProds.add(current);
                }
            }
        });
        
        if (newProds.size > 0) {
            newGrammar[lhs] = newProds;
        }
    }

    // UPDATED EXPLANATION LOGIC
    let explanation = "";
    if (nullable.size === 0) {
        explanation = "No changes needed at this step as there are no nullable variables.";
    } else {
        // Calculate compensation productions added
        let addedNullProds = [];
        for (let lhs in newGrammar) {
            newGrammar[lhs].forEach(prod => {
                if (!grammar[lhs].has(prod)) {
                    addedNullProds.push(`${lhs} -> ${prod}`);
                }
            });
        }

        explanation = `<b>Identified nullable variables:</b> [ ${Array.from(nullable).join(', ')} ]<br>`;
        explanation += `Removed 'e' productions and generated combinations.<br>`;
        if (addedNullProds.length > 0) {
            explanation += `<br><b>Compensation productions added:</b> [ ${addedNullProds.join(', ')} ]`;
        }
    }

    return { rules: newGrammar, explanation: explanation };
}

function eliminateUnit(grammar) {
    let newGrammar = {};
    let variables = Object.keys(grammar);
    let unitsFound = false;
    let directUnits = [];

    // Document direct units
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

    // Phase 1: Map reachable
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

    // Phase 2: Rebuild grammar
    variables.forEach(A => {
        newGrammar[A] = new Set();
        unitPairs[A].forEach(B => {
            if (grammar[B]) {
                grammar[B].forEach(prod => {
                    if (!(prod.length === 1 && isVariable(prod))) {
                        newGrammar[A].add(prod);
                    }
                });
            }
        });
    });

    for (let lhs in newGrammar) {
        if (newGrammar[lhs].size === 0) {
            delete newGrammar[lhs];
        }
    }

    // UPDATED EXPLANATION LOGIC
    let explanation = "";
    if (!unitsFound) {
        explanation = "No changes needed at this step as there are no unit productions.";
    } else {
        // Calculate compensation productions added
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
    let allVars = new Set(Object.keys(grammar));
    for (let lhs in grammar) {
        grammar[lhs].forEach(prod => {
            prod.split('').forEach(char => {
                if (isVariable(char)) allVars.add(char);
            });
        });
    }

    // Part 1: Non-Generating
    let generating = new Set();
    let added = true;
    while (added) {
        added = false;
        for (let lhs in grammar) {
            if (generating.has(lhs)) continue;
            for (let prod of grammar[lhs]) {
                let isGenerating = prod.split('').every(char => !isVariable(char) || generating.has(char));
                if (isGenerating) {
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
            if (prod.split('').every(char => !isVariable(char) || generating.has(char))) {
                newProds.add(prod);
            }
        });
        if (newProds.size > 0) {
            step1Grammar[lhs] = newProds;
        }
    }

    // Part 2: Unreachable
    let reachable = new Set(['S']); 
    let queue = ['S'];
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
    reachable.forEach(lhs => {
        if (step1Grammar[lhs]) finalGrammar[lhs] = step1Grammar[lhs];
    });

    // UPDATED EXPLANATION LOGIC
    let generatingArr = Array.from(generating);
    let nonGeneratingArr = Array.from(allVars).filter(v => !generating.has(v));
    let step1Vars = new Set(Object.keys(step1Grammar));
    let reachableArr = Array.from(reachable);
    let nonReachableArr = Array.from(step1Vars).filter(v => !reachable.has(v));

    let explanation = "";
    if (nonGeneratingArr.length === 0 && nonReachableArr.length === 0) {
        explanation = "No changes needed at this step as there are no useless symbols.";
    } else {
        // Calculate exactly what was removed
        let removedUselessProds = [];
        for (let lhs in grammar) {
            grammar[lhs].forEach(prod => {
                if (!finalGrammar[lhs] || !finalGrammar[lhs].has(prod)) {
                    removedUselessProds.push(`${lhs} -> ${prod}`);
                }
            });
        }

        explanation = `<b>Phase 1: Generating Symbols</b><br>`;
        explanation += `- Generating variables: [ ${generatingArr.join(', ') || 'None'} ]<br>`;
        explanation += `- Non-generating variables: [ ${nonGeneratingArr.join(', ') || 'None'} ]<br><br>`;
        
        explanation += `<b>Phase 2: Reachable Symbols</b><br>`;
        explanation += `- Reachable variables: [ ${reachableArr.join(', ') || 'None'} ]<br>`;
        explanation += `- Non-reachable variables: [ ${nonReachableArr.join(', ') || 'None'} ]<br><br>`;

        if (removedUselessProds.length > 0) {
            explanation += `<b>Productions removed:</b> [ ${removedUselessProds.join(', ')} ]`;
        }
    }

    return { rules: finalGrammar, explanation: explanation };
}
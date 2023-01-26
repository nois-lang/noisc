use crate::ast::ast_pair::Span;
use crate::ast::identifier::Identifier;
use crate::stdlib::lib::stdlib;
use log::error;
use std::collections::HashMap;

#[derive(Debug, PartialEq, Eq, Clone)]
pub struct AstContext {
    pub input: String,
    pub linting_config: LintingConfig,
    pub global_scope: AstScope,
    pub scope_stack: Vec<AstScope>,
}

impl AstContext {
    pub fn stdlib(input: String, config: LintingConfig) -> AstContext {
        let defs: HashMap<_, _> = stdlib().into_iter().flat_map(|p| p.definitions).collect();
        AstContext {
            input,
            linting_config: config,
            global_scope: AstScope {
                definitions: defs.keys().map(|i| (i.clone(), None)).collect(),
                usage: HashMap::new(),
            },
            scope_stack: vec![AstScope::default()],
        }
    }

    pub fn definitions(&self) -> HashMap<Identifier, Option<Span>> {
        let mut defs = HashMap::new();
        for s in &self.scope_stack {
            defs.extend(s.definitions.clone())
        }
        defs
    }

    pub fn is_defined(&self, identifier: &Identifier) -> bool {
        let found = self
            .scope_stack
            .iter()
            .chain([&self.global_scope])
            .filter_map(|s| s.definitions.get(identifier))
            .count()
            > 0;
        if !found {
            error!("definition {} not found in ctx {:?}", identifier, self);
        }
        found
    }
}

#[derive(Debug, PartialEq, Eq, Clone, Default)]
pub struct AstScope {
    pub definitions: HashMap<Identifier, Option<Span>>,
    pub usage: HashMap<Identifier, Span>,
}

impl AstScope {
    /// Get used identifiers that are not provided by the map
    pub fn external(
        self,
        definitions: &HashMap<Identifier, Option<Span>>,
    ) -> HashMap<Identifier, Span> {
        self.usage
            .into_iter()
            .filter(|(i, _)| !definitions.contains_key(i))
            .collect()
    }
}

#[derive(Debug, PartialEq, Eq, Clone)]
pub struct LintingConfig {
    pub check_undefined_ids: bool,
}

impl LintingConfig {
    pub fn full() -> LintingConfig {
        LintingConfig {
            check_undefined_ids: true,
        }
    }

    pub fn none() -> LintingConfig {
        LintingConfig {
            check_undefined_ids: false,
        }
    }
}

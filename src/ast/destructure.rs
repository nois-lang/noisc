use crate::ast::ast_pair::AstPair;
use crate::ast::identifier::Identifier;

#[derive(Debug, PartialOrd, PartialEq, Clone)]
pub enum Assignee {
    Hole,
    DestructureList(DestructureList),
    Identifier(AstPair<Identifier>),
}

impl Assignee {
    pub fn flatten(&self) -> Vec<AstPair<Identifier>> {
        match self {
            Assignee::Hole => vec![],
            Assignee::DestructureList(DestructureList(is)) => {
                is.iter().flat_map(|di| di.1.flatten()).collect()
            }
            Assignee::Identifier(i) => vec![i.clone()],
        }
    }
}

#[derive(Debug, PartialOrd, PartialEq, Clone)]
pub struct DestructureList(pub Vec<AstPair<DestructureItem>>);

#[derive(Debug, PartialOrd, PartialEq, Clone)]
pub enum DestructureItem {
    Hole,
    SpreadHole,
    Identifier {
        identifier: AstPair<Identifier>,
        spread: bool,
    },
    List(DestructureList),
}

impl DestructureItem {
    pub fn flatten(&self) -> Vec<AstPair<Identifier>> {
        match self {
            DestructureItem::Hole => vec![],
            DestructureItem::SpreadHole => vec![],
            DestructureItem::Identifier { identifier: i, .. } => vec![i.clone()],
            DestructureItem::List(DestructureList(is)) => {
                is.iter().flat_map(|di| di.1.flatten()).collect()
            }
        }
    }
}

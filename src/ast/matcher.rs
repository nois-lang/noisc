use crate::ast::ast_pair::AstPair;
use crate::ast::block::Block;
use crate::ast::identifier::Identifier;

#[derive(Debug, PartialOrd, PartialEq, Clone)]
pub struct MatchClause {
    pub pattern: AstPair<PatternItem>,
    pub block: AstPair<Block>,
}

#[derive(Debug, PartialOrd, PartialEq, Clone)]
pub enum PatternItem {
    Hole,
    SpreadHole,
    Integer(i128),
    Float(f64),
    Boolean(bool),
    String(String),
    Identifier {
        identifier: AstPair<Identifier>,
        spread: bool,
    },
    PatternList(Vec<AstPair<PatternItem>>),
}

use std::cell::RefMut;
use std::fmt::{Display, Formatter};
use std::ops::Deref;

use log::debug;

use crate::ast::ast::{
    AstPair, BinaryOperator, Block, Expression, FunctionCall, FunctionInit, Identifier, Operand,
    Statement,
};
use crate::error::Error;
use crate::interpret::context::{Context, Definition, Scope};
use crate::interpret::destructure::assign_definitions;
use crate::interpret::matcher::match_expression;
use crate::interpret::value::Value;

#[derive(Debug, PartialEq, Clone)]
pub enum FunctionCallType {
    Function,
    Operator,
}

impl Display for FunctionCallType {
    fn fmt(&self, f: &mut Formatter<'_>) -> std::fmt::Result {
        write!(
            f,
            "{}",
            match self {
                FunctionCallType::Function => "function",
                FunctionCallType::Operator => "operator",
            }
        )
    }
}

pub trait Evaluate {
    fn eval(&self, ctx: &mut RefMut<Context>, eager: bool) -> Result<AstPair<Value>, Error>;
}

impl Evaluate for AstPair<Block> {
    fn eval(&self, ctx: &mut RefMut<Context>, eager: bool) -> Result<AstPair<Value>, Error> {
        debug!("eval {:?}, eager: {}", &self, eager);
        let mut last_res = self.map(|_| Value::Unit);
        for statement in &self.1.statements {
            last_res = statement.eval(ctx, eager)?;
            let scope = ctx.scope_stack.last().unwrap();
            if let Some(rv) = scope.return_value.clone() {
                debug!("block interrupt - return, value: {:?}", &rv);
                return Ok(statement.map(|_| rv.clone()));
            }
        }
        Ok(last_res)
    }
}

impl Evaluate for AstPair<Statement> {
    fn eval(&self, ctx: &mut RefMut<Context>, eager: bool) -> Result<AstPair<Value>, Error> {
        let unit = Ok(self.map(|_| Value::Unit));
        debug!("eval {:?}, eager: {}", &self, eager);
        match &self.1 {
            Statement::Expression(exp) => exp.eval(ctx, eager),
            Statement::Assignment {
                assignee,
                expression,
            } => {
                let defs =
                    assign_definitions(assignee.clone(), expression.clone(), ctx, |i, e| {
                        Definition::User(i, e)
                    })?;
                ctx.scope_stack.last_mut().unwrap().definitions.extend(defs);
                unit
            }
            Statement::Return(v) => {
                let return_value = match v {
                    Some(a) => a.eval(ctx, true)?.1,
                    None => Value::Unit,
                };
                ctx.scope_stack.last_mut().unwrap().return_value = Some(return_value.clone());
                debug!("return value: {:?}", &return_value);
                unit
            }
        }
    }
}

impl Evaluate for AstPair<Expression> {
    fn eval(&self, ctx: &mut RefMut<Context>, eager: bool) -> Result<AstPair<Value>, Error> {
        debug!("eval {:?}, eager: {}", &self, eager);
        match &self.1 {
            Expression::Operand(op) => op.eval(ctx, eager),
            Expression::Unary { operator, operand } => {
                let fc = FunctionCall {
                    identifier: operator.map(|o| Identifier(format!("{}", o))),
                    arguments: vec![operand.deref().clone()],
                };
                let a = self.map(|_| fc.clone());
                function_call(&a, ctx, FunctionCallType::Operator)
            }
            Expression::Binary {
                left_operand,
                operator,
                right_operand,
            } => {
                if operator.1 == BinaryOperator::Accessor {
                    let l = left_operand.eval(ctx, true)?;
                    ctx.scope_stack.last_mut().unwrap().method_callee = Some(l);
                    right_operand.eval(ctx, eager)
                } else {
                    let fc = FunctionCall {
                        identifier: operator.map(|o| Identifier(format!("{}", o))),
                        arguments: vec![left_operand, right_operand]
                            .into_iter()
                            .map(|p| p.deref())
                            .cloned()
                            .collect(),
                    };
                    let a = self.map(|_| fc.clone());
                    function_call(&a, ctx, FunctionCallType::Function)
                }
            }
            Expression::MatchExpression { .. } => {
                let p_match = match_expression(self.clone(), ctx)?;
                match p_match {
                    Some((clause, pm)) => {
                        ctx.scope_stack.push(
                            Scope::new("<match_predicate>".to_string())
                                .with_definitions(pm.into_iter().collect())
                                .with_callee(Some(clause.0.clone())),
                        );
                        debug!("push scope {:?}", &ctx.scope_stack.last().unwrap());

                        let res = clause.1.block.eval(ctx, true);
                        let rv = &ctx.scope_stack.last().unwrap().return_value.clone();

                        debug!("pop scope @{}", &ctx.scope_stack.last().unwrap().name);
                        ctx.scope_stack.pop();

                        if let Some(v) = rv {
                            debug!("propagating return from match clause, value: {:?}", v);
                            ctx.scope_stack.last_mut().unwrap().return_value = rv.clone();
                        }

                        res.map_err(|e| {
                            Error::new_cause(
                                e,
                                "<match clause>".to_string(),
                                &clause.1.block.0,
                                &ctx.ast_context,
                            )
                        })
                    }
                    None => {
                        debug!("no matches in match expression {:?}", &self);
                        Ok(self.map(|_| Value::Unit))
                    }
                }
            }
        }
    }
}

pub fn function_call(
    function_call: &AstPair<FunctionCall>,
    ctx: &mut RefMut<Context>,
    call_type: FunctionCallType,
) -> Result<AstPair<Value>, Error> {
    let mut args: Vec<AstPair<Value>> = vec![];
    if let Some(mc) = ctx.scope_stack.last().unwrap().method_callee.clone() {
        args.push(mc);
    }
    args.extend(
        function_call
            .1
            .arguments
            .iter()
            .map(|a| a.eval(ctx, false))
            .collect::<Result<Vec<_>, _>>()?,
    );
    let name = function_call.1.identifier.1.clone().0;
    ctx.scope_stack.push(
        Scope::new(name.clone())
            .with_callee(Some(function_call.0.clone()))
            .with_arguments(args.clone()),
    );
    debug!("push scope @{}", name);

    let id = &function_call.1.identifier;
    debug!("function call {:?}, args: {:?}", &function_call, &args);
    let res = match ctx.find_definition(&id.1) {
        Some(Definition::User(_, exp)) => exp.eval(ctx, true),
        Some(Definition::System(f)) => f(args.clone(), ctx),
        Some(Definition::Value(v)) => Ok(v),
        None => Err(Error::from_span(
            &function_call.0,
            &ctx.ast_context,
            format!("{} '{}' not found", call_type, id.1),
        )),
    };
    debug!("function {:?} result {:?}", &id, &res);

    debug!("pop scope @{}", &ctx.scope_stack.last().unwrap().name);
    ctx.scope_stack.pop();
    res.map_err(|e| Error::new_cause(e, id.1.to_string(), &function_call.0, &ctx.ast_context))
}

impl Evaluate for AstPair<Operand> {
    fn eval(&self, ctx: &mut RefMut<Context>, eager: bool) -> Result<AstPair<Value>, Error> {
        debug!("eval {:?}, eager: {}", &self, eager);
        match &self.1 {
            Operand::Integer(i) => Ok(self.map(|_| Value::I(*i))),
            Operand::Float(f) => Ok(self.map(|_| Value::F(*f))),
            Operand::Boolean(b) => Ok(self.map(|_| Value::B(*b))),
            Operand::String(s) => {
                // TODO: assign each list item correct span
                Ok(self.map(|_| Value::List {
                    items: s.chars().map(|c| Value::C(c)).collect(),
                    spread: false,
                }))
            }
            Operand::ValueType(vt) => Ok(self.map(|_| Value::Type(vt.clone()))),
            Operand::FunctionCall(fc) => {
                function_call(&self.map(|_| fc.clone()), ctx, FunctionCallType::Function)
            }
            Operand::FunctionInit(fi) => self.map(|_| fi.clone()).eval(ctx, eager),
            Operand::ListInit { items } => {
                let l = Value::List {
                    items: match items
                        .into_iter()
                        .map(|i| {
                            let v = i.eval(ctx, eager).map(|a| a.1);
                            v
                        })
                        .collect::<Result<Vec<_>, _>>()
                    {
                        Ok(r) => r
                            .into_iter()
                            .flat_map(|i| match i {
                                Value::List {
                                    items,
                                    spread: true,
                                } => items,
                                _ => vec![i],
                            })
                            .collect(),
                        Err(e) => {
                            return Err(Error::new_cause(
                                e,
                                "<list construction>".to_string(),
                                &self.0,
                                &ctx.ast_context,
                            ));
                        }
                    },
                    spread: false,
                };
                Ok(self.map(|_| l.clone()))
            }
            Operand::Identifier(i) => i.eval(ctx, eager),
            _ => Err(Error::from_span(
                &self.0,
                &ctx.ast_context,
                format!("operand {:?} cannot be evaluated", self.1),
            )),
        }
    }
}

impl Evaluate for AstPair<FunctionInit> {
    fn eval(&self, ctx: &mut RefMut<Context>, eager: bool) -> Result<AstPair<Value>, Error> {
        if eager {
            let scope = ctx.scope_stack.last().unwrap().clone();
            for (param, v) in self.1.parameters.iter().zip(scope.arguments.clone()) {
                let defs = assign_definitions(param.clone(), v, ctx, |_, e| Definition::Value(e))?;
                ctx.scope_stack.last_mut().unwrap().definitions.extend(defs);
            }
            debug!(
                "eval function init scope @{}: {:?}",
                &scope.clone().name,
                &scope.clone().definitions
            );
            self.1.block.eval(ctx, eager)
        } else {
            Ok(AstPair::from_span(&self.0, Value::Fn(self.1.clone())))
        }
    }
}

impl Evaluate for AstPair<Identifier> {
    fn eval(&self, ctx: &mut RefMut<Context>, eager: bool) -> Result<AstPair<Value>, Error> {
        debug!("eval {:?}, eager: {}", &self, eager);
        let res = match ctx.find_definition(&self.1) {
            Some(res) => res.eval(ctx, eager),
            None => Err(Error::from_span(
                &self.0,
                &ctx.ast_context,
                format!("identifier '{}' not found", self.1),
            )),
        };
        debug!("result {:?}: {:?}", &self, res);
        res
    }
}

/// Evaluate lazy values
impl Evaluate for AstPair<Value> {
    fn eval(&self, ctx: &mut RefMut<Context>, eager: bool) -> Result<AstPair<Value>, Error> {
        debug!("eval value {:?}, eager: {}", &self, eager);
        if !eager {
            return Ok(self.clone());
        }
        match &self.1 {
            Value::Fn(f) => self.map(|_| f.deref().clone()).eval(ctx, eager),
            _ => Ok(self.clone()),
        }
    }
}

impl Evaluate for Definition {
    fn eval(&self, ctx: &mut RefMut<Context>, eager: bool) -> Result<AstPair<Value>, Error> {
        debug!("eval {:?}, eager: {}", &self, eager);
        match self {
            Definition::User(_, exp) => exp.eval(ctx, eager),
            // TODO: check if it's ok to clone args since fn might want to modify them
            Definition::System(f) => f(ctx.scope_stack.last().unwrap().clone().arguments, ctx),
            Definition::Value(v) => Ok(v.clone()),
        }
    }
}

#[cfg(test)]
mod tests {
    use std::cell::RefCell;
    use std::vec;

    use crate::ast::ast::{AstContext, ValueType};
    use crate::ast::ast_parser::parse_block;
    use crate::error::Error;
    use crate::interpret::context::Context;
    use crate::interpret::evaluate::Evaluate;
    use crate::interpret::value::Value;
    use crate::parser::NoisParser;

    fn evaluate(source: &str, eager: bool) -> Result<Value, Error> {
        let a_ctx = AstContext {
            input: source.to_string(),
        };
        let pt = NoisParser::parse_program(a_ctx.input.as_str());
        let ast = pt.and_then(|parsed| parse_block(&parsed))?;
        let ctx_cell = RefCell::new(Context::stdlib(a_ctx));
        let ctx = &mut ctx_cell.borrow_mut();
        ast.eval(ctx, eager).map(|a| a.1)
    }

    fn evaluate_eager(source: &str) -> Result<Value, Error> {
        evaluate(source, true)
    }

    #[test]
    fn evaluate_literals() {
        assert_eq!(evaluate_eager(""), Ok(Value::Unit));
        assert_eq!(evaluate_eager("{}"), Ok(Value::Unit));
        assert_eq!(evaluate_eager("4"), Ok(Value::I(4)));
        assert_eq!(evaluate_eager("4.56"), Ok(Value::F(4.56)));
        assert_eq!(evaluate_eager("1e12"), Ok(Value::F(1e12)));
        assert_eq!(
            evaluate_eager("'a'").map(|r| r.to_string()),
            Ok("a".to_string())
        );
        assert_eq!(
            evaluate_eager("[]"),
            Ok(Value::List {
                items: vec![],
                spread: false,
            })
        );
        assert_eq!(
            evaluate_eager("[1, 2]"),
            Ok(Value::List {
                items: vec![Value::I(1), Value::I(2)],
                spread: false,
            })
        );
        assert_eq!(
            evaluate_eager("'ab'"),
            Ok(Value::List {
                items: vec![Value::C('a'), Value::C('b')],
                spread: false,
            })
        );
        assert_eq!(
            evaluate_eager("[1, 'b']"),
            Ok(Value::List {
                items: vec![
                    Value::I(1),
                    Value::List {
                        items: vec![Value::C('b')],
                        spread: false,
                    },
                ],
                spread: false,
            })
        );
        assert!(matches!(evaluate("a -> a", false), Ok(Value::Fn(..))));
        assert_eq!(
            evaluate_eager("[C]"),
            Ok(Value::List {
                items: vec![Value::Type(ValueType::Char)],
                spread: false,
            })
        );
    }

    #[test]
    fn evaluate_assignee_basic() {
        assert_eq!(evaluate_eager("a = 4\na"), Ok(Value::I(4)));
        assert_eq!(evaluate_eager("_ = 4"), Ok(Value::Unit));
        assert_eq!(evaluate_eager("[a, b] = [1, 2]\na"), Ok(Value::I(1)));
        assert_eq!(evaluate_eager("[a, b] = [1, 2]\nb"), Ok(Value::I(2)));
        assert_eq!(evaluate_eager("[a, b] = [1, 2, 3]\na").is_err(), true);
        assert_eq!(evaluate_eager("[a, _, c] = [1, 2, 3]\nc"), Ok(Value::I(3)));
        assert_eq!(
            evaluate_eager("[_, [c, _]] = [[1, 2], [3, 4]]\nc"),
            Ok(Value::I(3))
        );
    }

    #[test]
    fn evaluate_value_equality() {
        assert_eq!(evaluate_eager("1 == 1"), Ok(Value::B(true)));
        assert_eq!(evaluate_eager("'foo' == 'foo'"), Ok(Value::B(true)));
        assert_eq!(evaluate_eager("'' == ''"), Ok(Value::B(true)));
        assert_eq!(evaluate_eager("[] == ''"), Ok(Value::B(true)));
        assert_eq!(evaluate_eager("[] == []"), Ok(Value::B(true)));
        assert_eq!(evaluate_eager("() == ()"), Ok(Value::B(true)));
        assert_eq!(evaluate_eager("f = a -> {}\n f == f"), Ok(Value::B(true)));

        assert_eq!(evaluate_eager("a -> {} == a -> {}"), Ok(Value::B(false)));
        assert_eq!(evaluate_eager("1 == 2"), Ok(Value::B(false)));
        assert_eq!(evaluate_eager("1 == '1'"), Ok(Value::B(false)));
        assert_eq!(evaluate_eager("1 == [1]"), Ok(Value::B(false)));
    }

    #[test]
    fn evaluate_value_type() {
        assert_eq!(
            evaluate_eager("type(1)"),
            Ok(Value::Type(ValueType::Integer))
        );
        assert_eq!(
            evaluate_eager("type(1.5)"),
            Ok(Value::Type(ValueType::Float))
        );
        assert_eq!(
            evaluate_eager("type(True)"),
            Ok(Value::Type(ValueType::Boolean))
        );
        assert_eq!(
            evaluate_eager("type([])"),
            Ok(Value::List {
                items: vec![Value::Type(ValueType::Any)],
                spread: false,
            })
        );
        assert_eq!(
            evaluate_eager("type('')"),
            Ok(Value::List {
                items: vec![Value::Type(ValueType::Any)],
                spread: false,
            })
        );
        assert_eq!(
            evaluate_eager("type('abc')"),
            Ok(Value::List {
                items: vec![Value::Type(ValueType::Char)],
                spread: false,
            })
        );
        assert_eq!(
            evaluate_eager("type(-> 1)"),
            Ok(Value::Type(ValueType::Function))
        );
        assert_eq!(
            evaluate_eager("type([1, 2, 3])"),
            Ok(Value::List {
                items: vec![Value::Type(ValueType::Integer)],
                spread: false,
            })
        );
        assert_eq!(
            evaluate_eager("type([1, 'abc', 1.5])"),
            Ok(Value::List {
                items: vec![
                    Value::Type(ValueType::Integer),
                    Value::List {
                        items: vec![Value::Type(ValueType::Char)],
                        spread: false,
                    },
                    Value::Type(ValueType::Float),
                ],
                spread: false,
            })
        );
        assert_eq!(evaluate_eager("type(C)"), Ok(Value::Type(ValueType::Type)));
        assert_eq!(
            evaluate_eager("type(['abc'])"),
            Ok(Value::List {
                items: vec![Value::List {
                    items: vec![Value::Type(ValueType::Char)],
                    spread: false,
                },],
                spread: false,
            })
        );
    }

    #[test]
    fn evaluate_value_type_equality() {
        assert_eq!(evaluate_eager("type(1) == I"), Ok(Value::B(true)));
        assert_eq!(evaluate_eager("type([]) == [*]"), Ok(Value::B(true)));
        assert_eq!(evaluate_eager("type('') == [*]"), Ok(Value::B(true)));
        assert_eq!(evaluate_eager("type('a') == [C]"), Ok(Value::B(true)));
        assert_eq!(evaluate_eager("type(['a']) == [[C]]"), Ok(Value::B(true)));
        assert_eq!(evaluate_eager("type([[]]) == [[*]]"), Ok(Value::B(true)));
        assert_eq!(evaluate_eager("* == ()"), Ok(Value::B(true)));
        assert_eq!(evaluate_eager("I == *"), Ok(Value::B(true)));
        assert_eq!(evaluate_eager("[I] == *"), Ok(Value::B(true)));
        assert_eq!(evaluate_eager("[I] == [*]"), Ok(Value::B(true)));

        assert_eq!(evaluate_eager("type(1) == C"), Ok(Value::B(false)));
        assert_eq!(evaluate_eager("type('a') == [I]"), Ok(Value::B(false)));
        assert_eq!(evaluate_eager("type(['a']) == [C]"), Ok(Value::B(false)));
        assert_eq!(evaluate_eager("[C] == [[*]]"), Ok(Value::B(false)));
        assert_eq!(evaluate_eager("I == [*]"), Ok(Value::B(false)));
    }

    // TODO: more tests
}

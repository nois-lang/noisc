use std::cell::RefMut;
use std::fmt::{Display, Formatter};
use std::ops::Deref;

use log::debug;

use crate::ast::ast::{
    AstPair, BinaryOperator, Block, Expression, FunctionCall, FunctionInit, Identifier, Operand,
    Statement, UnaryOperator,
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
    fn eval(&self, ctx: &mut RefMut<Context>) -> Result<AstPair<Value>, Error>;
}

impl Evaluate for AstPair<Block> {
    fn eval(&self, ctx: &mut RefMut<Context>) -> Result<AstPair<Value>, Error> {
        debug!("eval {:?}", &self);
        let mut last_res = self.map(|_| Value::Unit);
        for statement in &self.1.statements {
            last_res = statement.eval(ctx)?;
            let scope = ctx.scope_stack.last().unwrap();
            if let Some(rv) = scope.return_value.clone() {
                debug!("block interrupted by return, value: {:?}", &rv);
                return Ok(statement.map(|_| rv.clone()));
            }
        }
        debug!("block return value: {:?}", last_res);
        Ok(last_res)
    }
}

impl Evaluate for AstPair<Statement> {
    fn eval(&self, ctx: &mut RefMut<Context>) -> Result<AstPair<Value>, Error> {
        let unit = Ok(self.map(|_| Value::Unit));
        debug!("eval {:?}", &self);
        match &self.1 {
            Statement::Expression(exp) => exp.eval(ctx),
            // TODO: reassignment
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
                    Some(a) => a.eval(ctx)?.1,
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
    fn eval(&self, ctx: &mut RefMut<Context>) -> Result<AstPair<Value>, Error> {
        debug!("eval {:?}", &self);
        match &self.1 {
            Expression::Operand(op) => op.eval(ctx),
            Expression::Unary { operator, operand }
                if matches!(&operator.1, UnaryOperator::ArgumentList(..)) =>
            {
                let args = match &operator.1 {
                    UnaryOperator::ArgumentList(args) => args.clone(),
                    _ => unreachable!(),
                };
                let fc = FunctionCall {
                    callee: self.map(|_| operand.deref().1.clone()),
                    arguments: args,
                };
                function_call(&self.map(|_| fc.clone()), ctx, FunctionCallType::Function)
            }
            Expression::Unary { operator, operand } => {
                let fc = FunctionCall::new_by_name(
                    operator.deref().0,
                    operator.1.to_string().as_str(),
                    vec![operand.deref().clone()],
                );
                let a = self.map(|_| fc.clone());
                function_call(&a, ctx, FunctionCallType::Operator)
            }
            Expression::Binary {
                left_operand,
                operator,
                right_operand,
            } => {
                if operator.1 == BinaryOperator::Accessor {
                    let l = left_operand.eval(ctx)?;
                    ctx.scope_stack.last_mut().unwrap().method_callee = Some(l);
                    right_operand.eval(ctx)
                } else {
                    let fc = FunctionCall::new_by_name(
                        operator.deref().0,
                        operator.1.to_string().as_str(),
                        vec![left_operand, right_operand]
                            .into_iter()
                            .map(|p| p.deref())
                            .cloned()
                            .collect(),
                    );
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
                                .with_callee(Some(clause.0)),
                        );
                        debug!("push scope {:?}", &ctx.scope_stack.last().unwrap());

                        let res = clause.1.block.eval(ctx);
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
    debug!("function call {:?}", function_call);
    let mut args: Vec<AstPair<Value>> = vec![];
    if let Some(mc) = ctx.scope_stack.last().unwrap().method_callee.clone() {
        debug!("method call on {:?}", mc);
        args.push(mc);
        debug!("consuming scope method callee");
        ctx.scope_stack.last_mut().unwrap().method_callee = None;
    }
    args.extend(
        function_call
            .1
            .arguments
            .iter()
            .map(|a| a.eval(ctx))
            .collect::<Result<Vec<_>, _>>()?,
    );

    let id = function_call.1.as_identifier();
    let name = id.clone().map(|i| i.1 .0).unwrap_or("<anon>".to_string());
    let mut callee = None;
    if id.is_none() {
        debug!("eval function callee {:?}", function_call.1.callee);
        callee = Some(function_call.1.callee.eval(ctx)?);
        debug!("function callee {:?}", callee);
    }

    let scope = Scope::new(name.clone())
        .with_callee(Some(function_call.0))
        .with_arguments(Some(args.clone()));
    debug!("push scope @{}: {:?}", name, scope);
    ctx.scope_stack.push(scope);

    let res = if let Some(i) = id {
        match ctx.find_definition(&i.1) {
            Some(d) => d.eval(ctx),
            None => Err(Error::from_span(
                &function_call.0,
                &ctx.ast_context,
                format!("{} '{}' not found", call_type, name),
            )),
        }
    } else {
        let f = match callee.unwrap().1 {
            f @ Value::Closure(..) => Ok(f),
            v => Err(Error::from_span(
                &function_call.0,
                &ctx.ast_context,
                format!("expression not callable: {}", v),
            )),
        }?;
        function_call.map(|_| f.clone()).eval(ctx)
    };
    debug!("{} {:?} result {:?}", &call_type, &name, &res);

    debug!("pop scope @{}", &ctx.scope_stack.last().unwrap().name);
    ctx.scope_stack.pop();

    res.map_err(|e| Error::new_cause(e, name, &function_call.0, &ctx.ast_context))
}

impl Evaluate for AstPair<Operand> {
    fn eval(&self, ctx: &mut RefMut<Context>) -> Result<AstPair<Value>, Error> {
        debug!("eval {:?}", &self);
        match &self.1 {
            Operand::Integer(i) => Ok(self.map(|_| Value::I(*i))),
            Operand::Float(f) => Ok(self.map(|_| Value::F(*f))),
            Operand::Boolean(b) => Ok(self.map(|_| Value::B(*b))),
            Operand::String(s) => Ok(self.map(|_| Value::List {
                items: s.chars().map(|c| Value::C(c)).collect(),
                spread: false,
            })),
            Operand::ValueType(vt) => Ok(self.map(|_| Value::Type(vt.clone()))),
            Operand::FunctionInit(fi) => self.map(|_| fi.clone()).eval(ctx),
            Operand::ListInit { items } => {
                let l = Value::List {
                    items: match items
                        .into_iter()
                        .map(|i| {
                            let v = i.eval(ctx).map(|a| a.1);
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
            Operand::Identifier(i) => i.eval(ctx),
            _ => Err(Error::from_span(
                &self.0,
                &ctx.ast_context,
                format!("operand {:?} cannot be evaluated", self.1),
            )),
        }
    }
}

impl Evaluate for AstPair<FunctionInit> {
    fn eval(&self, ctx: &mut RefMut<Context>) -> Result<AstPair<Value>, Error> {
        let scope = ctx.scope_stack.last().unwrap().clone();
        let o_args = scope.arguments.clone();
        // if scope has args, this is a function call and function init must be evaluated
        debug!("eval {:?}, args: {:?}", &self, &o_args);
        if o_args.is_some() {
            for (param, v) in self.1.parameters.iter().zip(o_args.unwrap().clone()) {
                let defs = assign_definitions(param.clone(), v, ctx, |_, e| Definition::Value(e))?;
                ctx.scope_stack.last_mut().unwrap().definitions.extend(defs);
            }

            debug!(
                "consuming scope @{} arguments: {:?}",
                scope.name, scope.arguments
            );
            ctx.scope_stack.last_mut().unwrap().arguments = None;

            debug!(
                "function init scope @{}: {:?}",
                scope.name, scope.definitions
            );
            self.1.block.eval(ctx)
        } else {
            let closure = &self.1.closure;
            let v = if closure.is_empty() {
                Value::Fn(self.1.clone())
            } else {
                let defs = closure
                    .into_iter()
                    .map(|i| {
                        let def = ctx.find_definition(i).ok_or_else(|| {
                            Error::from_span(
                                &self.0,
                                &ctx.ast_context,
                                format!("identifier {} not found: (required for closure)", i),
                            )
                        })?;
                        Ok((i.clone(), def))
                    })
                    .collect::<Result<_, _>>()?;
                debug!("lazy init function with context snapshot {:?}", &ctx);
                // TODO: pass required definitions
                Value::Closure(self.1.clone(), defs)
            };
            Ok(AstPair::from_span(&self.0, v))
        }
    }
}

impl Evaluate for AstPair<Identifier> {
    fn eval(&self, ctx: &mut RefMut<Context>) -> Result<AstPair<Value>, Error> {
        debug!("eval {:?}", &self);
        let res = match ctx.find_definition(&self.1) {
            Some(res) => res.eval(ctx),
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

impl Evaluate for AstPair<Value> {
    fn eval(&self, ctx: &mut RefMut<Context>) -> Result<AstPair<Value>, Error> {
        debug!("eval value {:?}", &self);
        let scope = ctx.scope_stack.last().unwrap();
        match &self.1 {
            Value::Fn(f) if scope.arguments.is_some() => {
                debug!("eval function {:?}", &f);
                self.map(|_| f.deref().clone()).eval(ctx)
            }
            Value::Closure(f, defs) if scope.arguments.is_some() => {
                debug!("eval closure {:?}", &f);
                debug!("extending scope with captured definitions: {:?}", defs);
                ctx.scope_stack
                    .last_mut()
                    .unwrap()
                    .definitions
                    .extend(defs.clone());
                self.map(|_| f.deref().clone()).eval(ctx)
            }
            Value::System(sf) if scope.arguments.is_some() => {
                // TODO: store sys function name
                debug!("eval system function");
                sf.0(scope.arguments.clone().unwrap(), ctx)
            }
            _ => Ok(self.clone()),
        }
    }
}

impl Evaluate for Definition {
    fn eval(&self, ctx: &mut RefMut<Context>) -> Result<AstPair<Value>, Error> {
        debug!("eval definition {:?}", &self);
        let scope = ctx.scope_stack.last().unwrap();
        match &self {
            Definition::User(_, exp) => exp.eval(ctx),
            Definition::System(f) => {
                let m_args = scope.arguments.clone();
                if let Some(args) = m_args {
                    debug!(
                        "consuming scope @{} arguments: {:?}",
                        scope.name, scope.arguments
                    );
                    ctx.scope_stack.last_mut().unwrap().arguments = None;

                    f.0(args, ctx)
                } else {
                    let callee = scope.callee.unwrap();
                    Ok(AstPair(callee, Value::System(f.clone())))
                }
            }
            Definition::Value(v) => v.eval(ctx),
        }
    }
}

#[cfg(test)]
mod tests {
    use std::cell::RefCell;
    use std::vec;

    use crate::ast::ast::ValueType;
    use crate::ast::ast_parser::parse_block;
    use crate::error::Error;
    use crate::interpret::context::Context;
    use crate::interpret::evaluate::Evaluate;
    use crate::interpret::value::Value;
    use crate::parser::NoisParser;

    fn evaluate(source: &str) -> Result<Value, Error> {
        let ctx = &Context::stdlib(source.to_string());
        let ctx_cell = RefCell::new(ctx.clone());
        let ctx_bm = &mut ctx_cell.borrow_mut();

        let a_ctx_cell = RefCell::new(ctx.ast_context.clone());
        let a_ctx_bm = &mut a_ctx_cell.borrow_mut();

        let pt = NoisParser::parse_program(source)?;
        let ast = parse_block(&pt, a_ctx_bm)?;
        ast.eval(ctx_bm).map(|a| a.1)
    }

    #[test]
    fn evaluate_literals() {
        assert_eq!(evaluate(""), Ok(Value::Unit));
        assert_eq!(evaluate("4"), Ok(Value::I(4)));
        assert_eq!(evaluate("4.56"), Ok(Value::F(4.56)));
        assert_eq!(evaluate("1e12"), Ok(Value::F(1e12)));
        assert_eq!(evaluate("'a'").map(|r| r.to_string()), Ok("a".to_string()));
        assert_eq!(
            evaluate("[]"),
            Ok(Value::List {
                items: vec![],
                spread: false,
            })
        );
        assert_eq!(
            evaluate("[1, 2]"),
            Ok(Value::List {
                items: vec![Value::I(1), Value::I(2)],
                spread: false,
            })
        );
        assert_eq!(
            evaluate("'ab'"),
            Ok(Value::List {
                items: vec![Value::C('a'), Value::C('b')],
                spread: false,
            })
        );
        assert_eq!(
            evaluate("[1, 'b']"),
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
        assert!(matches!(evaluate("a -> a"), Ok(Value::Fn(..))));
        assert_eq!(
            evaluate("[C]"),
            Ok(Value::List {
                items: vec![Value::Type(ValueType::Char)],
                spread: false,
            })
        );
    }

    #[test]
    fn evaluate_assignee_basic() {
        assert_eq!(evaluate("a = 4\na"), Ok(Value::I(4)));
        assert_eq!(evaluate("_ = 4"), Ok(Value::Unit));
        assert_eq!(evaluate("[a, b] = [1, 2]\na"), Ok(Value::I(1)));
        assert_eq!(evaluate("[a, b] = [1, 2]\nb"), Ok(Value::I(2)));
        assert_eq!(evaluate("[a, b] = [1, 2, 3]\na").is_err(), true);
        assert_eq!(evaluate("[a, _, c] = [1, 2, 3]\nc"), Ok(Value::I(3)));
        assert_eq!(
            evaluate("[_, [c, _]] = [[1, 2], [3, 4]]\nc"),
            Ok(Value::I(3))
        );
    }

    #[test]
    fn evaluate_value_equality() {
        assert_eq!(evaluate("1 == 1"), Ok(Value::B(true)));
        assert_eq!(evaluate("'foo' == 'foo'"), Ok(Value::B(true)));
        assert_eq!(evaluate("'' == ''"), Ok(Value::B(true)));
        assert_eq!(evaluate("[] == ''"), Ok(Value::B(true)));
        assert_eq!(evaluate("[] == []"), Ok(Value::B(true)));
        assert_eq!(evaluate("() == ()"), Ok(Value::B(true)));
        assert_eq!(evaluate("f = a -> {}\n f == f"), Ok(Value::B(true)));

        assert_eq!(evaluate("(a -> {}) == (a -> {})"), Ok(Value::B(false)));
        assert_eq!(evaluate("1 == 2"), Ok(Value::B(false)));
        assert_eq!(evaluate("1 == '1'"), Ok(Value::B(false)));
        assert_eq!(evaluate("1 == [1]"), Ok(Value::B(false)));
    }

    #[test]
    fn evaluate_value_type() {
        assert_eq!(evaluate("type(1)"), Ok(Value::Type(ValueType::Integer)));
        assert_eq!(evaluate("type(1.5)"), Ok(Value::Type(ValueType::Float)));
        assert_eq!(evaluate("type(True)"), Ok(Value::Type(ValueType::Boolean)));
        assert_eq!(
            evaluate("type([])"),
            Ok(Value::List {
                items: vec![Value::Type(ValueType::Any)],
                spread: false,
            })
        );
        assert_eq!(
            evaluate("type('')"),
            Ok(Value::List {
                items: vec![Value::Type(ValueType::Any)],
                spread: false,
            })
        );
        assert_eq!(
            evaluate("type('abc')"),
            Ok(Value::List {
                items: vec![Value::Type(ValueType::Char)],
                spread: false,
            })
        );
        assert_eq!(evaluate("type(-> 1)"), Ok(Value::Type(ValueType::Function)));
        assert_eq!(
            evaluate("type([1, 2, 3])"),
            Ok(Value::List {
                items: vec![Value::Type(ValueType::Integer)],
                spread: false,
            })
        );
        assert_eq!(
            evaluate("type([1, 'abc', 1.5])"),
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
        assert_eq!(evaluate("type(C)"), Ok(Value::Type(ValueType::Type)));
        assert_eq!(
            evaluate("type(['abc'])"),
            Ok(Value::List {
                items: vec![Value::List {
                    items: vec![Value::Type(ValueType::Char)],
                    spread: false,
                }],
                spread: false,
            })
        );
    }

    #[test]
    fn evaluate_value_type_equality() {
        assert_eq!(evaluate("type(1) == I"), Ok(Value::B(true)));
        assert_eq!(evaluate("type([]) == [*]"), Ok(Value::B(true)));
        assert_eq!(evaluate("type('') == [*]"), Ok(Value::B(true)));
        assert_eq!(evaluate("type('a') == [C]"), Ok(Value::B(true)));
        assert_eq!(evaluate("type(['a']) == [[C]]"), Ok(Value::B(true)));
        assert_eq!(evaluate("type([[]]) == [[*]]"), Ok(Value::B(true)));
        assert_eq!(evaluate("* == ()"), Ok(Value::B(true)));
        assert_eq!(evaluate("I == *"), Ok(Value::B(true)));
        assert_eq!(evaluate("[I] == *"), Ok(Value::B(true)));
        assert_eq!(evaluate("[I] == [*]"), Ok(Value::B(true)));

        assert_eq!(evaluate("type(1) == C"), Ok(Value::B(false)));
        assert_eq!(evaluate("type('a') == [I]"), Ok(Value::B(false)));
        assert_eq!(evaluate("type(['a']) == [C]"), Ok(Value::B(false)));
        assert_eq!(evaluate("[C] == [[*]]"), Ok(Value::B(false)));
        assert_eq!(evaluate("I == [*]"), Ok(Value::B(false)));
    }

    #[test]
    fn evaluate_assignee_spread_hole() {
        assert_eq!(evaluate("[..] = [1, 2, 3]"), Ok(Value::Unit));
        assert_eq!(evaluate("[a, ..] = [1, 2, 3]\na"), Ok(Value::I(1)));
        assert_eq!(evaluate("[.., a] = [1, 2, 3]\na"), Ok(Value::I(3)));
        assert_eq!(evaluate("[_, a, ..] = [1, 2, 3]\na"), Ok(Value::I(2)));
        assert_eq!(evaluate("[_, a, ..] = range(100)\na"), Ok(Value::I(1)));
    }

    #[test]
    fn evaluate_match_spread_hole() {
        assert_eq!(evaluate("match [1, 2, 3] { [..] => 5 }"), Ok(Value::I(5)));
        assert_eq!(
            evaluate("match [1, 2, 3] { [a, ..] => a }"),
            Ok(Value::I(1))
        );
        assert_eq!(
            evaluate("match range(100) { [_, .., a] => a }"),
            Ok(Value::I(99))
        );
    }

    // TODO: more tests
}

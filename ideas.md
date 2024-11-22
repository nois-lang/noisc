- std::test
- noisdoc
  documentation testing: https://doc.rust-lang.org/rust-by-example/testing/doc_testing.html
- orphan instances: https://wiki.haskell.org/index.php?title=Orphan_instance
  should impls be allowed only when at least one of (A, B) (in impl A for B) is defined in the current package?
  possible solutions:
    * disallow, throw error when detected in impl definition
    * allow, throw error when two dependency packages provide conflicting impls
    * allow, give an interface to prioritize one conflicting impl over another
    * allow, make orphan impls local to the current package
      - causes coherence problems: https://xnning.github.io/papers/coherence-class.pdf

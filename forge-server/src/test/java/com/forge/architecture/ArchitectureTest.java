package com.forge.architecture;

import static com.tngtech.archunit.lang.syntax.ArchRuleDefinition.noClasses;

import com.forge.ForgeApplication;
import com.tngtech.archunit.core.domain.JavaClasses;
import com.tngtech.archunit.core.importer.ClassFileImporter;
import com.tngtech.archunit.core.importer.ImportOption;
import org.junit.jupiter.api.Test;
import org.springframework.modulith.core.ApplicationModules;
import org.springframework.modulith.docs.Documenter;

/**
 * The architecture is enforced by tests, not by good intentions. If someone reaches into another
 * module's internals or makes the domain depend on frameworks, the build fails.
 */
class ArchitectureTest {

  private static final JavaClasses CLASSES =
      new ClassFileImporter()
          .withImportOption(ImportOption.Predefined.DO_NOT_INCLUDE_TESTS)
          .importPackages("com.forge");

  @Test
  void modulesOnlyTalkThroughEachOthersPublicApi() {
    ApplicationModules.of(ForgeApplication.class).verify();
  }

  @Test
  void domainDoesNotDependOnWebOrAdapters() {
    noClasses()
        .that()
        .resideInAPackage("..domain..")
        .should()
        .dependOnClassesThat()
        .resideInAnyPackage(
            "..api..",
            "..infrastructure..",
            "org.springframework.web..",
            "com.github.dockerjava..",
            "org.eclipse.jgit..")
        .check(CLASSES);
  }

  @Test
  void controllersNeverUseRepositoriesDirectly() {
    noClasses()
        .that()
        .resideInAPackage("..api..")
        .should()
        .dependOnClassesThat()
        .haveSimpleNameEndingWith("Repository")
        .allowEmptyShould(true)
        .check(CLASSES);
  }

  @Test
  void onlyAdaptersTouchDockerAndGit() {
    noClasses()
        .that()
        .resideOutsideOfPackages("..infrastructure..", "com.forge.shared.docker..")
        .should()
        .dependOnClassesThat()
        .resideInAnyPackage("com.github.dockerjava..", "org.eclipse.jgit..")
        .check(CLASSES);
  }

  /** Writes module diagrams (PlantUML) to target/spring-modulith-docs for the documentation. */
  @Test
  void documentModules() {
    new Documenter(ApplicationModules.of(ForgeApplication.class))
        .writeModulesAsPlantUml()
        .writeIndividualModulesAsPlantUml();
  }
}

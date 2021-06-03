/**
 * Blocks for driving the BBS Motor Driver Board
 */
//% weight=100 color=#00A654 icon="\uf085" block="BBS Motor Driver"
namespace BBS_Motor_Controller {

    //Some useful parameters. 
        let ChipAddress = 0x40 //default Chip address
        let PrescaleReg = 0xFE //the prescale register address
        let Mode1Reg = 0x00  //The mode 1 register address

        let SERVOS = 0x06; // first servo address for start byte low
        let servoTarget: number[] = [];
        let servoActual: number[] = [];
        let servoCancel: boolean[] = [];
            
    // If you wanted to write some code that stepped through the servos then this is the BASe and size to do that 	
        let Servo1RegBase = 0x08 
        let ServoRegDistance = 4
        //To get the PWM pulses to the correct size and zero offset these are the default numbers. 
        let ServoMultiplier = 226
        let ServoZeroOffset = 0x66
    
        let initalised = false //a flag to allow us to initialise without explicitly calling the secret incantation
    
        //nice big list of servos for the block to use. These represent register offsets in the PCA9865
        export enum Servos {
            Servo1 = 0x40,
            Servo2 = 0x44
            /*Servo1 = 0x08,
            Servo2 = 0x0C,
            Servo3 = 0x10,
            Servo4 = 0x14,
            Servo5 = 0x18,
            Servo6 = 0x1C,
            Servo7 = 0x20,
            Servo8 = 0x24,
            Servo9 = 0x28,
            Servo10 = 0x2C,
            Servo11 = 0x30,
            Servo12 = 0x34,
            Servo13 = 0x38,
            Servo14 = 0x3C,
            Servo15 = 0x40,
            Servo16 = 0x44,*/
        }

        export enum Motors {
            Motor1 = 1,
            Motor2 = 2,
            Motor3 = 3,
            Motor4 = 4
            /*Motor1 = 0x08,
            Motor2 = 0x0C,
            Motor3 = 0x10,
            Motor4 = 0x14,
            Servo5 = 0x18,
            Servo6 = 0x1C,
            Servo7 = 0x20,
            Servo8 = 0x24,
            Servo9 = 0x28,
            Servo10 = 0x2C,
            Servo11 = 0x30,
            Servo12 = 0x34,
            Servo13 = 0x38,
            Servo14 = 0x3C,
            Servo15 = 0x40,
            Servo16 = 0x44,*/
        }
    
        export enum BoardAddresses{
            Board1 = 0x6A,
            
        }
        //Trim the servo pulses. These are here for advanced users, and not exposed to blocks.
        //It appears that servos I've tested are actually expecting 0.5 - 2.5mS pulses, 
        //not the widely reported 1-2mS 
        //that equates to multiplier of 226, and offset of 0x66
        // a better trim function that does the maths for the end user could be exposed, the basics are here 
        // for reference
    
        export function TrimServoMultiplier(Value: number) {
            if (Value < 113) {
                ServoMultiplier = 113
            }
            else {
                if (Value > 226) {
                    ServoMultiplier = 226
                }
                else {
                    ServoMultiplier = Value
                }
    
            }
        }
        export function TrimServoZeroOffset(Value: number) {
            if (Value < 0x66) {
                ServoZeroOffset = 0x66
            }
            else {
                if (Value > 0xCC) {
                    ServoZeroOffset = 0xCC
                }
                else {
                    ServoZeroOffset = Value
                }
    
            }
        }

        /**
         * Initialise all servos to Angle=0
         */
        //% blockId="centreServos"
        //% block="centre all servos"
        //% subcategory=Servos
        export function centreServos(): void
        {
           
            setServo(Servos.Servo1, 0);
            setServo(Servos.Servo2, 0);
        }

        /**
         * Set Servo Position by Angle
         * @param servo Servo number (0 to 15)
         * @param angle degrees to turn servo (-90 to +90)
         */
        //% blockId="an_setServo" block="set servo %servo| to angle %angle"
        //% weight=70
        //% angle.min=-90 angle.max.max=90
        //% subcategory=Servos
        export function setServo(servo: Servos, angle: number): void
        {
            let servoNumber = 15;
            if(servo == Servos.Servo2){
                servoNumber = 14;
            }
            setServoRaw(servoNumber, angle);
            servoTarget[servoNumber] = angle;
        }


        function setServoRaw(servo: Servos, angle: number): void
        {
            if (initalised == false)
            {
                secretIncantation();
            }
            // two bytes need setting for start and stop positions of the servo
            // servos start at SERVOS (0x06) and are then consecutive blocks of 4 bytes
            // the start position (always 0x00) is set during init for all servos

            let i2cData = pins.createBuffer(2);
            let start = 0;
            angle = Math.max(Math.min(90, angle),-90);
            let stop = 369 + angle * 223 / 90;

            i2cData[0] = SERVOS + servo*4 + 2;	// Servo register
            i2cData[1] = (stop & 0xff);		// low byte stop
            pins.i2cWriteBuffer(ChipAddress, i2cData, false);

            i2cData[0] = SERVOS + servo*4 + 3;	// Servo register
            i2cData[1] = (stop >> 8);		// high byte stop
            pins.i2cWriteBuffer(ChipAddress, i2cData, false);
            servoActual[servo] = angle;
        }


            /**
         * Move Servo to Target Position at selected Speed
         * @param servo Servo number (0 to 15)
         * @param angle degrees to turn to (-90 to +90)
         * @param speed degrees per second to move (1 to 1000) eg: 60
         */
        //% blockId="moveServo" block="move servo %servo| to angle %angle| at speed %speed| degrees/sec"
        //% weight=70
        //% angle.min=-90 angle.max.max=90
        //% speed.min=1 speed.max=1000
        //% subcategory=Servos
        export function moveServo(servo: Servos, angle: number, speed: number): void
        {
            let servoNumber = 15;
            if(servo == Servos.Servo2){
                servoNumber = 14;
            }
            let step = 1;
            let delay = 10; // 10ms delay between steps
            if(servoTarget[servoNumber] != servoActual[servoNumber])   // cancel any existing movement on this servo?
            {
                servoCancel[servoNumber] = true;
                while(servoCancel[servoNumber])
                    basic.pause(1);  // yield
            }
            angle = Math.max(Math.min(90, angle),-90);
            speed = Math.max(Math.min(1000, speed),1);
            delay = Math.round(1000/speed);
            servoTarget[servoNumber] = angle;
            if (angle < servoActual[servoNumber])
                step = -1;
            control.inBackground(() =>
            {
                while (servoActual[servoNumber] != servoTarget[servoNumber])
                {
                    if(servoCancel[servoNumber])
                    {
                        servoCancel[servoNumber] = false;
                        break;
                    }
                    setServoRaw(servoNumber, servoActual[servoNumber]+step);
                    basic.pause(delay);
                }
            })
        }

        /**
         * Get Servo Current Actual Position
         * @param servo Servo number (0 to 15)
         */
        //% blockId="getServoActual" block="servo %servo| actual position"
        //% weight=10
        //% subcategory=Servos
        export function getServoActual(servo: Servos): number
        {
            let servoNumber = 15;
            if(servo == Servos.Servo2){
                servoNumber = 14;
            }

            return servoActual[servoNumber];
        }

        /**
         * Get Servo Target Position
         * @param servo Servo number (0 to 15)
         */
        //% blockId="getServoTarget" block="servo %servo| target position"
        //% weight=8
        //% subcategory=Servos
        export function getServoTarget(servo: Servos): number
        {
            let servoNumber = 15;
            if(servo == Servos.Servo2){
                servoNumber = 14;
            }
            return servoTarget[servoNumber];
        }

        /**
         * Check if servo has reached target
         * @param servo Servo number (0 to 15)
         */
        //% blockId="isServoDone" block="servo %servo| is complete"
        //% weight=5
        //% subcategory=Servos
        export function isServoDone(servo: Servos): boolean
        {
            let servoNumber = 15;
            if(servo == Servos.Servo2){
                servoNumber = 14;
            }
            return servoTarget[servoNumber]==servoActual[servoNumber];
        }

        /**
         * Wait until servo has reached target position
         * @param servo Servo number (0 to 15)
         */
        //% blockId="waitServo" block="wait for servo %servo"
        //% weight=5
        //% subcategory=Servos
        export function waitServo(servo: Servos): void
        {
            let servoNumber = 15;
            if(servo == Servos.Servo2){
                servoNumber = 14;
            }

            while (servoActual[servoNumber] != servoTarget[servoNumber]) // what if nothing is changing these values?
                basic.pause(10);
        }
    
        /*
            This secret incantation sets up the PCA9865 I2C driver chip to be running at 50Hx pulse repetition, and then sets the 16 output registers to 1.5mS - centre travel.
            It should not need to be called directly be a user - the first servo write will call it.
        
        */
        function secretIncantation(): void {
            let buf = pins.createBuffer(2)
    
           
            
            buf[0] = 0  // Mode 1 register
            buf[1] = 0x10 // put to sleep
            pins.i2cWriteBuffer(ChipAddress, buf, false)
           
            buf[0] = 0xFE;	// Prescale register
            buf[1] = 101;	// set to 60 Hz
            pins.i2cWriteBuffer(ChipAddress, buf, false)
            buf[0] = 0;		// Mode 1 register
            buf[1] = 0x81;	// Wake up
            pins.i2cWriteBuffer(ChipAddress, buf, false)
            

            for (let servo=0; servo<16; servo++)
            {
                buf[0] = SERVOS + servo*4 + 0;	// Servo register
                buf[1] = 0x00;			// low byte start - always 0
                pins.i2cWriteBuffer(ChipAddress, buf, false);

                buf[0] = SERVOS + servo*4 + 1;	// Servo register
                buf[1] = 0x00;			// high byte start - always 0
                pins.i2cWriteBuffer(ChipAddress, buf, false);

                servoTarget[servo]=0;
                servoActual[servo]=0;
                servoCancel[servo]=false;

            
            }
            //set the initalised flag so we dont come in here again automatically
            initalised = true
        }

        /**
         * Sets the requested motor to the given speed.
         * if the PCA has not yet been initialised calls the initialisation routine
         *
         * @param Motor Which motor to set
         * @param speed the angle to set the servo to
         */
        //% blockId=bbs_I2Cmotor_write
        //% block="set%Motor|to%speed"
        //% speed.min=-100 speed.max=4096
        
        export function MotorWrite(Motor: Motors, speed: number): void {
            if (initalised == false) {
                secretIncantation()
            }

            //need to look at the speed and motor number to determine the pins to activate.
            let m1pin1 = 0;
            let m1pin2 = 0;
            let m1pwm = 0;
            
            if(Motor == Motors.Motor1){
                m1pin1 = 0;
                m1pin2 = 1;
                m1pwm = 2;
            }

            if(Motor == Motors.Motor2){
                m1pin1 = 3;
                m1pin2 = 4;
                m1pwm = 5;
            }

            if(Motor == Motors.Motor3){
                m1pin1 = 6;
                m1pin2 = 7;
                m1pwm = 8;
            }

            if(Motor == Motors.Motor4){
                m1pin1 = 9;
                m1pin2 = 10;
                m1pwm = 11;
            }
            
            let i2cData = pins.createBuffer(2);
            
            //power up pin 1 and 2
            if(speed > 0)
            {
                //forward - on
                i2cData[0] = SERVOS + m1pin1*4 + 2;	// Servo register
                i2cData[1] = (4096 & 0xff);		// low byte stop
                pins.i2cWriteBuffer(ChipAddress, i2cData, false);

                i2cData[0] = SERVOS + m1pin1*4 + 3;	// Servo register
                i2cData[1] = (4096 >> 8);		// high byte stop
                pins.i2cWriteBuffer(ChipAddress, i2cData, false);

                //forward - off
                i2cData[0] = SERVOS + m1pin2*4 + 2;	// Servo register
                i2cData[1] = (0 & 0xff);		// low byte stop
                pins.i2cWriteBuffer(ChipAddress, i2cData, false);

                i2cData[0] = SERVOS + m1pin2*4 + 3;	// Servo register
                i2cData[1] = (0 >> 8);		// high byte stop
                pins.i2cWriteBuffer(ChipAddress, i2cData, false);
                

            }
            else if (speed < 0)
            {
                
                //forward - off
                i2cData[0] = SERVOS + m1pin1*4 + 2;	// 
                i2cData[1] = (0 & 0xff);		// 
                pins.i2cWriteBuffer(ChipAddress, i2cData, false);

                i2cData[0] = SERVOS + m1pin1*4 + 3;	// 
                i2cData[1] = (0 >> 8);		// 
                pins.i2cWriteBuffer(ChipAddress, i2cData, false);

                //forward - on
                i2cData[0] = SERVOS + m1pin2*4 + 2;	// 
                i2cData[1] = (4096 & 0xff);		// 
                pins.i2cWriteBuffer(ChipAddress, i2cData, false);

                i2cData[0] = SERVOS + m1pin2*4 + 3;	// 
                i2cData[1] = (4096 >> 8);		// 
                pins.i2cWriteBuffer(ChipAddress, i2cData, false);
                
            }
            else
            {
                //stop
                i2cData[0] = SERVOS + m1pin1*4 + 2;	// 
                i2cData[1] = (4096 & 0xff);		// 
                pins.i2cWriteBuffer(ChipAddress, i2cData, false);

                i2cData[0] = SERVOS + m1pin1*4 + 3;	// 
                i2cData[1] = (4096 >> 8);		// 
                pins.i2cWriteBuffer(ChipAddress, i2cData, false);

                //forward - on
                i2cData[0] = SERVOS + m1pin2*4 + 2;	// 
                i2cData[1] = (4096 & 0xff);		// 
                pins.i2cWriteBuffer(ChipAddress, i2cData, false);

                i2cData[0] = SERVOS + m1pin2*4 + 3;	// 
                i2cData[1] = (4096 >> 8);		// 
                pins.i2cWriteBuffer(ChipAddress, i2cData, false);
            }

            //enable pins on.

            i2cData[0] = SERVOS + 12*4 + 2;	// 
            i2cData[1] = (4096 & 0xff);		// 
            pins.i2cWriteBuffer(ChipAddress, i2cData, false);

            i2cData[0] = SERVOS + 12*4 + 3;	// 
            i2cData[1] = (4096 >> 8);		// 
            pins.i2cWriteBuffer(ChipAddress, i2cData, false);


            i2cData[0] = SERVOS + 13*4 + 2;	// 
            i2cData[1] = (4096 & 0xff);		// 
            pins.i2cWriteBuffer(ChipAddress, i2cData, false);

            i2cData[0] = SERVOS + 13*4 + 3;	// 
            i2cData[1] = (4096 >> 8);		// 
            pins.i2cWriteBuffer(ChipAddress, i2cData, false);


            
            //pwm pin

            i2cData[0] = SERVOS + m1pwm*4 + 2;	// 
            i2cData[1] = (speed & 0xff);		// 
            pins.i2cWriteBuffer(ChipAddress, i2cData, false);

            i2cData[0] = SERVOS + m1pwm*4 + 3;	// 
            i2cData[1] = (speed >> 8);		// 
            pins.i2cWriteBuffer(ChipAddress, i2cData, false);
        }
        
        
            
    
    }